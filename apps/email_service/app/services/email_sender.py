"""Email sending service with SMTP and retry logic"""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx
from jinja2 import Template

from app.core.config import settings
from app.core.logger import logger
from app.schemas.email_schema import EmailMessage, EmailTemplate
from app.services.circuit_breaker import CircuitBreaker, CircuitBreakerError


class EmailSender:
    """
    Email sending service with:
    - SMTP support
    - Template rendering (Jinja2)
    - Circuit breaker for fault tolerance
    - Exponential backoff retry
    """
    
    def __init__(self):
        self.smtp_config = {
            'host': settings.smtp_host,
            'port': settings.smtp_port,
            'user': settings.smtp_user,
            'password': settings.smtp_password,
            'from_email': settings.smtp_from_email,
            'from_name': settings.smtp_from_name,
        }
        
        # Circuit breakers for external dependencies
        self.smtp_circuit = CircuitBreaker(
            name="smtp",
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
        
        logger.info("EmailSender initialized with SMTP configuration")
    
    async def send_email(self, message: EmailMessage) -> tuple[bool, Optional[str]]:
        """Send an email using the configured SMTP server."""
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

                template = await self.template_circuit.call(
                    self._fetch_template,
                    message.template_code,
                )
                subject, html_body = self._render_template(template, message.variables)

                await self.smtp_circuit.call(
                    self._send_via_smtp,
                    to_email=message.user_email,
                    subject=subject,
                    html_body=html_body,
                )

                logger.info(
                    "Email sent: notification_id=%s to=%s attempt=%s",
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
            # Template service returns html_body and text_body, we prefer html_body
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
    
    async def _send_via_smtp(self, to_email: str, subject: str, html_body: str):
        """
        Send email via SMTP
        
        Args:
            to_email: Recipient email
            subject: Email subject
            html_body: HTML body
            
        Raises:
            smtplib.SMTPException: If SMTP fails
        """
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            self._send_smtp_sync,
            to_email,
            subject,
            html_body,
        )
    
    def _send_smtp_sync(self, to_email: str, subject: str, html_body: str):
        """
        Synchronous SMTP send (runs in executor)
        
        Args:
            to_email: Recipient email
            subject: Email subject
            html_body: HTML body
            
        Raises:
            smtplib.SMTPException: If SMTP fails
        """
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{self.smtp_config['from_name']} <{self.smtp_config['from_email']}>"
        msg['To'] = to_email
        
        # Attach HTML body
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        # Send via SMTP
        if self.smtp_config['port'] == 465:
            # Use SMTP_SSL for port 465
            with smtplib.SMTP_SSL(self.smtp_config['host'], self.smtp_config['port']) as server:
                if self.smtp_config['user'] and self.smtp_config['password']:
                    server.login(self.smtp_config['user'], self.smtp_config['password'])
                else:
                    logger.warning("SMTP credentials not provided; attempting anonymous send")

                server.send_message(msg)
        else:
            # Use SMTP with STARTTLS for port 587
            with smtplib.SMTP(self.smtp_config['host'], self.smtp_config['port']) as server:
                server.starttls()

                if self.smtp_config['user'] and self.smtp_config['password']:
                    server.login(self.smtp_config['user'], self.smtp_config['password'])
                else:
                    logger.warning("SMTP credentials not provided; attempting anonymous send")

                server.send_message(msg)
        
        logger.info(f"SMTP send successful: to={to_email}")
    
    def get_circuit_states(self) -> dict:
        """Get circuit breaker states for monitoring"""
        return {
            "smtp": self.smtp_circuit.get_state(),
            "template_service": self.template_circuit.get_state()
        }
