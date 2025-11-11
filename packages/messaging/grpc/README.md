# gRPC Support for Distributed Notifications

This package contains Protocol Buffer definitions and utilities for gRPC communication between services.

## Why gRPC?

**Use gRPC for:**

- ✅ High-performance, low-latency synchronous calls
- ✅ Strong typing and schema validation
- ✅ Bi-directional streaming (future feature)
- ✅ Language interoperability (Node.js ↔ Python)
- ✅ Efficient binary serialization (smaller payload than JSON)

## Setup

### Node.js Services

```bash
pnpm add @grpc/grpc-js @grpc/proto-loader
```

### Python Services (email_service)

```bash
pip install grpcio grpcio-tools
```

## Generate Code

### For Node.js:

```bash
# Install grpc-tools globally
npm install -g grpc-tools

# Generate code
grpc_tools_node_protoc \
  --js_out=import_style=commonjs,binary:./node \
  --grpc_out=grpc_js:./node \
  --plugin=protoc-gen-grpc=$(which grpc_tools_node_protoc_plugin) \
  ./notifications.proto
```

### For Python:

```bash
python -m grpc_tools.protoc \
  -I. \
  --python_out=./python \
  --grpc_python_out=./python \
  ./notifications.proto
```

## Usage Examples

### Node.js Client (API Gateway calling User Service)

```typescript
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

const PROTO_PATH = path.join(__dirname, "../grpc/notifications.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const notificationsProto =
  grpc.loadPackageDefinition(packageDefinition).notifications;

// Create client
const userClient = new notificationsProto.UserService(
  "user_service:50051",
  grpc.credentials.createInsecure()
);

// Make RPC call
userClient.GetUser({ user_id: "123" }, (error, response) => {
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("User:", response.user);
});
```

### Python Server (User Service)

```python
import grpc
from concurrent import futures
import notifications_pb2
import notifications_pb2_grpc

class UserServiceServicer(notifications_pb2_grpc.UserServiceServicer):
    def GetUser(self, request, context):
        # Fetch user from database
        user = notifications_pb2.User(
            user_id=request.user_id,
            email="user@example.com",
            full_name="John Doe"
        )
        return notifications_pb2.UserResponse(user=user)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    notifications_pb2_grpc.add_UserServiceServicer_to_server(
        UserServiceServicer(), server
    )
    server.add_insecure_port('[::]:50051')
    server.start()
    server.wait_for_termination()
```

## Service Ports

- User Service gRPC: `50051`
- Template Service gRPC: `50052`
- Push Service gRPC: `50053`

## Best Practices

1. **Use gRPC for synchronous, low-latency calls** between services
2. **Use RabbitMQ for asynchronous, event-driven communication**
3. **Always implement health checks** (gRPC has built-in health checking)
4. **Use deadlines/timeouts** to prevent hanging requests
5. **Implement retry logic** with exponential backoff
6. **Use interceptors** for logging, authentication, and metrics
