import httpx
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio
import random

class ServiceClient:
    """
    HTTP Client with Retry Logic and Circuit Breaker for Python services
    Use for: Synchronous request-response patterns
    """
    
    def __init__(
        self,
        service_name: str,
        base_url: str,
        timeout: float = 5.0,
        max_retries: int = 3
    ):
        self.service_name = service_name
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={
                "Content-Type": "application/json",
                "User-Agent": f"notif-service/{service_name}",
            }
        )
    
    def _generate_request_id(self) -> str:
        """Generate unique request ID for idempotency"""
        return f"req_{datetime.now().timestamp()}_{random.randint(1000, 9999)}"
    
    async def _make_request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make HTTP request with exponential backoff retry"""
        
        request_headers = {
            "X-Request-ID": self._generate_request_id(),
            "X-Service-Name": self.service_name,
        }
        if headers:
            request_headers.update(headers)
        
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                response = await self.client.request(
                    method=method,
                    url=path,
                    json=data,
                    params=params,
                    headers=request_headers,
                )
                response.raise_for_status()
                return response.json() if response.content else {}
                
            except httpx.HTTPStatusError as e:
                # Don't retry 4xx errors (client errors)
                if 400 <= e.response.status_code < 500:
                    raise
                last_exception = e
                
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_exception = e
            
            # Exponential backoff
            if attempt < self.max_retries - 1:
                wait_time = (2 ** attempt) * 0.5  # 0.5s, 1s, 2s
                await asyncio.sleep(wait_time)
        
        raise Exception(f"Request to {self.service_name} failed after {self.max_retries} attempts: {last_exception}")
    
    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """HTTP GET request"""
        return await self._make_request("GET", path, params=params, headers=headers)
    
    async def post(
        self,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """HTTP POST request"""
        return await self._make_request("POST", path, data=data, headers=headers)
    
    async def put(
        self,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """HTTP PUT request"""
        return await self._make_request("PUT", path, data=data, headers=headers)
    
    async def delete(
        self,
        path: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """HTTP DELETE request"""
        return await self._make_request("DELETE", path, headers=headers)
    
    async def health_check(self) -> bool:
        """Check service health"""
        try:
            await self.get("/health")
            return True
        except Exception:
            return False
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


def create_service_clients() -> Dict[str, ServiceClient]:
    """Create pre-configured service clients"""
    import os
    
    return {
        "user_service": ServiceClient(
            "user_service",
            os.getenv("USER_SERVICE_URL", "http://localhost:4001"),
            timeout=5.0,
        ),
        "template_service": ServiceClient(
            "template_service",
            os.getenv("TEMPLATE_SERVICE_URL", "http://localhost:4002"),
            timeout=3.0,
        ),
        "push_service": ServiceClient(
            "push_service",
            os.getenv("PUSH_SERVICE_URL", "http://localhost:4100"),
            timeout=5.0,
        ),
    }
