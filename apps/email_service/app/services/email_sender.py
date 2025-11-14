"""Email sending service with Resend API"""

import asyncio
from typing import Any, Optional, cast

import httpx
import resend
from jinja2 import Template

from app.core.config import settings
from app.core.logger import logger
from app.schemas.email_schema import EmailMessage, EmailTemplate
from app.services.circuit_breaker import CircuitBreaker, CircuitBreakerError


class EmailSender:
    """
    Email sending service with:
    - Resend API
    - Template rendering (Jinja2)
    - Circuit breaker for fault tolerance
    - Exponential backoff retry
    """
    
    def __init__(self):
        # Validate Resend configuration
        if not settings.resend_api_key:
            raise ValueError("RESEND_API_KEY is required")
        
        # Initialize Resend SDK
        resend.api_key = settings.resend_api_key
        self.resend_from = f"{settings.resend_from_name} <{settings.resend_from_email}>"
        
        # Circuit breakers for external dependencies
        self.resend_circuit = CircuitBreaker(
            name="resend_api",
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
        
        logger.info(f"EmailSender initialized with Resend API: from={self.resend_from}")
    
    async def send_email(self, message: EmailMessage) -> tuple[bool, Optional[str]]:
        """
        Send an email via Resend API with retry logic.
        
        Args:
            message: Email message with template and variables
            
        Returns:
            Tuple of (success: bool, error: Optional[str])
        """
        last_error: Optional[str] = None

        for attempt in range(1, settings.max_retry_attempts + 1):
            try:
                logger.info(
                    "Sending email attempt %s/%s: notification_id=%s to=%s",
                    attempt,
                    settings.max_retry_attempts,
                    message.notification_id,
                    message.user_email,
                )

                # Fetch template from Template Service
                template = await self.template_circuit.call(
                    self._fetch_template,
                    message.template_code,
                )
                
                # Render template with variables
                subject, html_body = self._render_template(template, message.variables)

                # Send via Resend API
                await self.resend_circuit.call(
                    self._send_via_resend,
                    to_email=message.user_email,
                    subject=subject,
                    html_body=html_body,
                )

                logger.info(
                    "Email sent successfully: notification_id=%s to=%s attempt=%s",
                    message.notification_id,
                    message.user_email,
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
                    "Email send failed attempt %s/%s for notification_id=%s: %s",
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
            "Email send permanently failed after %s attempts for notification_id=%s: %s",
            settings.max_retry_attempts,
            message.notification_id,
            last_error,
        )
        return False, last_error
    
    async def _fetch_template(self, template_code: str) -> EmailTemplate:
        """
        Fetch email template from Template Service
        
        Args:
            template_code: Template identifier
            
        Returns:
            EmailTemplate
            
        Raises:
            httpx.HTTPError: If template fetch fails
        """
        url = f"{settings.template_service_url}/api/v1/templates/{template_code}"
        
        logger.info(f"Fetching template: code={template_code}, url={url}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            # Expecting response format: {"success": true, "data": {...}}
            if not data.get("success"):
                raise ValueError(f"Template service error: {data.get('error', 'Unknown error')}")
            
            template_data = data.get("data")
            if not template_data:
                raise ValueError(f"Template not found: {template_code}")
            
            # Convert to EmailTemplate
            # Template service returns html_body and text_body
            html_body = template_data.get("html_body", "")
            text_body = template_data.get("text_body", "")
            body = html_body if html_body else text_body
            
            logger.info(f"Template data received: code={template_code}, has_html_body={bool(html_body)}, has_text_body={bool(text_body)}, body_length={len(body)}")
            
            template = EmailTemplate(
                code=template_data.get("code", template_code),
                subject=template_data.get("subject", ""),
                body=body,
                variables=template_data.get("variables", []),
                language=template_data.get("language", "en")
            )
            
            logger.info(f"Template fetched successfully: code={template_code}, template_body_length={len(template.body)}")
            return template
    
    def _render_template(self, template: EmailTemplate, variables: dict) -> tuple[str, str]:
        """
        Render email template with variables using Jinja2
        
        Args:
            template: Email template
            variables: Variables to substitute
            
        Returns:
            Tuple of (subject, html_body)
        """
        try:
            # Render subject
            subject_template = Template(template.subject)
            rendered_subject = subject_template.render(**variables)
            
            # Render body
            body_template = Template(template.body)
            rendered_body = body_template.render(**variables)
            
            logger.info(f"Template rendered: code={template.code}, variables={list(variables.keys())}, rendered_body_length={len(rendered_body)}, rendered_subject='{rendered_subject}'")
            return rendered_subject, rendered_body
            
        except Exception as e:
            logger.error(f"Template rendering failed: code={template.code}, error={str(e)}")
            raise ValueError(f"Template rendering error: {str(e)}")
    
    async def _send_via_resend(self, to_email: str, subject: str, html_body: str):
        """
        Send email via Resend API
        
        Uses HTTPS (port 443)
        
        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_body: HTML email body
            
        Raises:
            Exception: If Resend API call fails
        """
        try:
            params: dict[str, Any] = {
                "from": self.resend_from,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }
            
            # Run Resend SDK call in executor to avoid blocking event loop
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: resend.Emails.send(params)  # type: ignore[arg-type]
            )
            
            email_id = response.get('id', 'N/A') if response else 'N/A'
            logger.info(f"Resend send successful: to={to_email}, email_id={email_id}")
            
        except Exception as e:
            logger.error(f"Resend send failed: to={to_email}, error={str(e)}")
            raise
    
    def get_circuit_states(self) -> dict:
        """
        Get circuit breaker states for health monitoring
        
        Returns:
            Dictionary with circuit breaker states
        """
        return {
            "resend_api": self.resend_circuit.get_state(),
            "template_service": self.template_circuit.get_state()
        }
