# Pattern 12: Serverless Microservices

## What is it?

Use managed compute services (Functions-as-a-Service) instead of managing servers. Cloud provider handles scaling, patching, and infrastructure.

---

## Key Characteristics

- **No server management** - Provider handles infrastructure
- **Auto-scaling** - Scales to zero, scales to millions
- **Pay-per-use** - Only pay when code runs
- **Event-driven** - Triggered by events

---

## Popular Platforms

| Platform               | Provider   | Runtime Support                 |
| ---------------------- | ---------- | ------------------------------- |
| AWS Lambda             | Amazon     | Node.js, Python, Java, Go, .NET |
| Azure Functions        | Microsoft  | Node.js, Python, C#, Java       |
| Google Cloud Functions | Google     | Node.js, Python, Go, Java       |
| Cloudflare Workers     | Cloudflare | JavaScript, WASM                |

---

## Serverless Stack Example (AWS)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│ API Gateway │────▶│   Lambda    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
              ┌──────────┐              ┌──────────┐              ┌──────────┐
              │ DynamoDB │              │    S3    │              │   SQS    │
              └──────────┘              └──────────┘              └──────────┘
```

---

## Best For

✅ **Event-driven systems** - Webhooks, notifications  
✅ **Startups** - Low initial cost  
✅ **Variable workloads** - Spiky traffic  
✅ **APIs with unpredictable load**  
✅ **Background jobs** - Image processing, ETL

---

## Not Ideal For

❌ **Long-running processes** - Timeout limits (15 min max)  
❌ **Consistent high traffic** - May be more expensive  
❌ **Low-latency requirements** - Cold start delays  
❌ **Stateful applications** - Functions are stateless

---

## Cold Start Problem

| Language | Cold Start |
| -------- | ---------- |
| Python   | 100-200ms  |
| Node.js  | 100-200ms  |
| Java     | 500ms-3s   |
| .NET     | 200-500ms  |

**Mitigation:**

- Provisioned concurrency
- Keep functions warm
- Use lighter runtimes

---

## Serverless vs Containers

| Aspect         | Serverless         | Containers           |
| -------------- | ------------------ | -------------------- |
| Scaling        | Automatic          | Configure HPA        |
| Cost           | Pay per invocation | Pay for running pods |
| Control        | Limited            | Full control         |
| Cold starts    | Yes                | No                   |
| Vendor lock-in | High               | Low                  |

---

## Key Takeaways

- **Serverless** = no infrastructure management
- Great for **event-driven** and **variable workloads**
- Watch out for **cold starts** and **timeouts**
- Consider **cost** at high scale
- Can combine with containers for hybrid approach

---

## 📊 Eraser.io Diagram Code

```eraser
// Serverless Architecture (AWS)
Client [icon: monitor, color: blue]
API Gateway [icon: server, color: orange]

Lambda Functions [icon: zap, color: yellow] {
  Users Function [icon: users]
  Orders Function [icon: shopping-cart]
  Products Function [icon: package]
}

DynamoDB [icon: database, color: blue]
S3 Bucket [icon: hard-drive, color: green]
SQS Queue [icon: layers, color: purple]
SNS Topic [icon: bell, color: red]

Client --> API Gateway: HTTPS
API Gateway --> Lambda Functions: Invoke
Lambda Functions --> DynamoDB: Read/Write
Lambda Functions --> S3 Bucket: Store files
Lambda Functions --> SQS Queue: Queue messages
Lambda Functions --> SNS Topic: Publish events
```

```eraser
// Event-Driven Serverless
S3 Upload [icon: upload, color: blue]
Image Processor Lambda [icon: zap, color: yellow]
Thumbnail S3 [icon: image, color: green]
DynamoDB [icon: database, color: orange]
SNS Notification [icon: bell, color: red]

S3 Upload --> Image Processor Lambda: Trigger on upload
Image Processor Lambda --> Thumbnail S3: Save thumbnail
Image Processor Lambda --> DynamoDB: Update metadata
Image Processor Lambda --> SNS Notification: Notify completion
```
