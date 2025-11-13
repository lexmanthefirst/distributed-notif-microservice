export const servicesConfig = {
  userService: {
    url: process.env.USER_SERVICE_URL || "http://localhost:4001",
  },
  templateService: {
    url: process.env.TEMPLATE_SERVICE_URL || "http://localhost:4002",
  },
  emailService: {
    url: process.env.EMAIL_SERVICE_URL || "http://localhost:8000",
  },
  pushService: {
    url: process.env.PUSH_SERVICE_URL || "http://localhost:4003",
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
  },
};
