"""Push notification sending service with FCM and APNS support"""

import asyncio
from typing import Any, Optional
import firebase_admin
from firebase_admin import credentials, messaging
from aioapns import APNs, NotificationRequest

from app.core.config import settings
from app.core.logger import logger
from app.schemas.push_schema import PushMessage, PushTemplate
from app.services.circuit_breaker import CircuitBreaker, CircuitBreakerError
import httpx
from jinja2 import Template


class PushSender:
    """
    Push notification sending service with:
    - Firebase Cloud Messaging (FCM) for Android
    - Apple Push Notification Service (APNS) for iOS
    - Template rendering (Jinja2)
    - Circuit breaker for fault tolerance
    - Exponential backoff retry
    """
    
    def __init__(self):
        # Initialize Firebase Admin SDK
        self._init_firebase()
        
        # Initialize APNS (will be None if not configured)
        self.apns_client: Optional[APNs] = None
        self._init_apns()
        
        # Circuit breakers for external dependencies
        self.fcm_circuit = CircuitBreaker(
            name="fcm_api",
            failure_threshold=settings.circuit_breaker_failure_threshold,
            timeout=settings.circuit_breaker_timeout,
            recovery_timeout=settings.circuit_breaker_recovery_timeout
        )
        
        self.apns_circuit = CircuitBreaker(
            name="apns_api",
            failure_threshold=settings.circuit_breaker_failure_threshold,
            timeout=settings.circuit_breaker_timeout,
            recovery_timeout=settings.circuit_breaker_recovery_timeout
        )
        
        self.template_circuit = CircuitBreaker(
            name="template_service",
            failure_threshold=settings.circuit_breaker_failure_threshold,
            timeout=settings.circuit_breaker_timeout,
            recovery_timeout=settings.circuit_breaker_recovery_timeout
        )
        
        logger.info("PushSender initialized")
    
    def _init_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            fcm_path = settings.get_fcm_credentials_path()
            if fcm_path:
                logger.info(f"Attempting to load FCM credentials from: {fcm_path}")
                cred = credentials.Certificate(fcm_path)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase initialized with service account")
            else:
                logger.warning("FCM credentials not configured - FCM push will fail")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
    
    def _init_apns(self):
        """Initialize APNS client"""
        try:
            apns_path = settings.get_apns_key_path()
            if apns_path and settings.apns_key_id and settings.apns_team_id:
                logger.info(f"Attempting to load APNS key from: {apns_path}")
                self.apns_client = APNs(
                    key=apns_path,
                    key_id=settings.apns_key_id,
                    team_id=settings.apns_team_id,
                    topic=settings.apns_bundle_id,
                    use_sandbox=settings.apns_use_sandbox
                )
                logger.info("APNS initialized")
            else:
                logger.warning("APNS not configured - iOS push will not work")
        except Exception as e:
            logger.error(f"Failed to initialize APNS: {e}")
    
    async def send_push(self, message: PushMessage) -> tuple[bool, Optional[str]]:
        """
        Send a push notification with retry logic.
        
        Args:
            message: Push message with template and variables
            
        Returns:
            Tuple of (success: bool, error: Optional[str])
        """
        last_error: Optional[str] = None

        for attempt in range(1, settings.max_retry_attempts + 1):
            try:
                logger.info(
                    "Sending push attempt %s/%s: notification_id=%s to=%s",
                    attempt,
                    settings.max_retry_attempts,
                    message.notification_id,
                    message.push_token[:20] + "..."
                )

                # Fetch template from Template Service
                template = await self.template_circuit.call(
                    self._fetch_template,
                    message.template_code,
                )
                
                # Render template with variables
                title, body = self._render_template(template, message.variables)

                # Determine platform and send
                platform = message.platform or self._detect_platform(message.push_token)
                
                if platform == "ios":
                    await self.apns_circuit.call(
                        self._send_via_apns,
                        token=message.push_token,
                        title=title,
                        body=body,
                        data=message.variables
                    )
                else:  # Default to FCM for Android
                    await self.fcm_circuit.call(
                        self._send_via_fcm,
                        token=message.push_token,
                        title=title,
                        body=body,
                        data=message.variables
                    )

                logger.info(
                    "Push sent successfully: notification_id=%s platform=%s attempt=%s",
                    message.notification_id,
                    platform,
                    attempt,
                )
                return True, None

            except CircuitBreakerError as exc:
                last_error = str(exc)
                logger.error(
                    "Circuit breaker open for notification_id=%s: %s",
                    message.notification_id,
                    last_error,
                )
                return False, last_error

            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                logger.error(
                    "Push send failed attempt %s/%s for notification_id=%s: %s",
                    attempt,
                    settings.max_retry_attempts,
                    message.notification_id,
                    last_error,
                )

                if attempt < settings.max_retry_attempts:
                    delay = settings.retry_base_delay ** attempt
                    logger.info("Retrying in %s seconds", delay)
                    await asyncio.sleep(delay)

        logger.error(
            "Push send permanently failed after %s attempts for notification_id=%s: %s",
            settings.max_retry_attempts,
            message.notification_id,
            last_error,
        )
        return False, last_error
    
    async def _fetch_template(self, template_code: str) -> PushTemplate:
        """Fetch push template from Template Service"""
        url = f"{settings.template_service_url}/api/v1/templates/{template_code}"
        
        logger.info(f"Fetching template: code={template_code}, url={url}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get("success"):
                raise ValueError(f"Template service error: {data.get('error', 'Unknown error')}")
            
            template_data = data.get("data")
            if not template_data:
                raise ValueError(f"Template not found: {template_code}")
            
            # For push notifications, subject becomes title, body is the message
            title = template_data.get("subject", "")
            body = template_data.get("html_body") or template_data.get("text_body", "")
            
            template = PushTemplate(
                code=template_data.get("code", template_code),
                title=title,
                body=body,
                variables=template_data.get("variables", []),
                language=template_data.get("language", "en")
            )
            
            logger.info(f"Template fetched successfully: code={template_code}")
            return template
    
    def _render_template(self, template: PushTemplate, variables: dict) -> tuple[str, str]:
        """
        Render push template with variables using Jinja2
        
        Args:
            template: Push template
            variables: Variables to substitute
            
        Returns:
            Tuple of (title, body)
        """
        try:
            # Render title
            title_template = Template(template.title)
            rendered_title = title_template.render(**variables)
            
            # Render body
            body_template = Template(template.body)
            rendered_body = body_template.render(**variables)
            
            # Strip HTML tags if present (push notifications don't support HTML)
            import re
            rendered_body = re.sub('<[^<]+?>', '', rendered_body)
            
            logger.info(f"Template rendered: code={template.code}")
            return rendered_title, rendered_body
            
        except Exception as e:
            logger.error(f"Template rendering failed: code={template.code}, error={str(e)}")
            raise ValueError(f"Template rendering error: {str(e)}")
    
    async def _send_via_fcm(self, token: str, title: str, body: str, data: dict):
        """
        Send push notification via Firebase Cloud Messaging (Android)
        
        Args:
            token: FCM device token
            title: Notification title
            body: Notification body
            data: Additional data payload
            
        Raises:
            Exception: If FCM send fails
        """
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data={k: str(v) for k, v in data.items()},  # FCM requires string values
                token=token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default'
                    )
                )
            )
            
            # Run FCM send in executor (it's synchronous)
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: messaging.send(message)
            )
            
            logger.info(f"FCM send successful: token={token[:20]}..., message_id={response}")
            
        except Exception as e:
            logger.error(f"FCM send failed: token={token[:20]}..., error={str(e)}")
            raise
    
    async def _send_via_apns(self, token: str, title: str, body: str, data: dict):
        """
        Send push notification via Apple Push Notification Service (iOS)
        
        Args:
            token: APNS device token
            title: Notification title
            body: Notification body
            data: Additional data payload
            
        Raises:
            Exception: If APNS send fails
        """
        if not self.apns_client:
            raise ValueError("APNS not configured")
        
        try:
            request = NotificationRequest(
                device_token=token,
                message={
                    "aps": {
                        "alert": {
                            "title": title,
                            "body": body
                        },
                        "sound": "default",
                        "badge": 1
                    },
                    **data  # Custom data
                }
            )
            
            await self.apns_client.send_notification(request)
            
            logger.info(f"APNS send successful: token={token[:20]}...")
            
        except Exception as e:
            logger.error(f"APNS send failed: token={token[:20]}..., error={str(e)}")
            raise
    
    def _detect_platform(self, token: str) -> str:
        """
        Detect platform from token format (basic heuristic)
        
        FCM tokens: Usually longer (>150 chars)
        APNS tokens: Usually 64 hex characters
        
        Args:
            token: Device token
            
        Returns:
            "ios" or "android"
        """
        if len(token) == 64 and all(c in '0123456789abcdefABCDEF' for c in token):
            return "ios"
        return "android"
    
    def get_circuit_states(self) -> dict:
        """
        Get circuit breaker states for health monitoring
        
        Returns:
            Dictionary with circuit breaker states
        """
        return {
            "fcm_api": self.fcm_circuit.get_state(),
            "apns_api": self.apns_circuit.get_state(),
            "template_service": self.template_circuit.get_state()
        }
