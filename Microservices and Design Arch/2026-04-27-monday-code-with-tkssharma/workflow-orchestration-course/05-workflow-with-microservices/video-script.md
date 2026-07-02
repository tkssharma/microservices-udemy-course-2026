# Module 5: Workflow Orchestration with Microservices

## 🎬 Video Script (Duration: ~40 minutes)

---

## Introduction (0:00 - 2:00)

Welcome back! Now we're getting into the technical implementation.

How do we actually **implement workflow orchestration in a microservices architecture**?

Based on my blog: [Camunda for Microservices](https://tkssharma.com/blog/camunda-for-microservices/)

---

## Architecture Overview (2:00 - 10:00)

### The Complete Picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW ORCHESTRATION ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      FRONTEND (React/Vue)                       │   │
│  │                    User Actions / UI Events                      │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                     │
│                                   ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      API GATEWAY                                │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                     │
│                                   ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    WORKFLOW SERVICE                             │   │
│  │              (Talks to Camunda Engine)                          │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  - Start workflow instances                             │   │   │
│  │  │  - Query workflow status                                │   │   │
│  │  │  - Send messages/signals                                │   │   │
│  │  │  - Complete user tasks                                  │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                     │
│                                   ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CAMUNDA ENGINE                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │                    REST API                             │   │   │
│  │  │  POST /process-definition/{key}/start                   │   │   │
│  │  │  GET  /task                                             │   │   │
│  │  │  POST /external-task/fetchAndLock                       │   │   │
│  │  │  POST /message                                          │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │              WORKFLOW DEFINITIONS (BPMN)                │   │   │
│  │  │  - order-process.bpmn                                   │   │   │
│  │  │  - payment-process.bpmn                                 │   │   │
│  │  │  - client-a-workflow.bpmn                               │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                     │
│              ┌────────────────────┼────────────────────┐               │
│              │                    │                    │               │
│              ▼                    ▼                    ▼               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │  External Task  │  │  External Task  │  │  External Task  │        │
│  │  Worker (Node)  │  │  Worker (Java)  │  │  Worker (Python)│        │
│  │                 │  │                 │  │                 │        │
│  │ - orderService  │  │ - paymentSvc    │  │ - analyticsJob  │        │
│  │ - notification  │  │ - inventorySvc  │  │ - mlPipeline    │        │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘        │
│           │                    │                    │                  │
│           ▼                    ▼                    ▼                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MICROSERVICES LAYER                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │  Order   │  │ Payment  │  │Inventory │  │Shipping  │        │   │
│  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components Explained

| Component | Role |
|-----------|------|
| **Frontend** | Sends user actions (place order, approve, etc.) |
| **Workflow Service** | Bridge between app and Camunda |
| **Camunda Engine** | Executes BPMN workflows |
| **External Task Workers** | Execute actual business logic |
| **Microservices** | Domain services (order, payment, etc.) |

---

## Camunda as Event Bus (10:00 - 18:00)

### Traditional Event Bus vs Camunda

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADITIONAL EVENT BUS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│            ┌────────────────────────────────┐                  │
│            │     KAFKA / RABBITMQ          │                  │
│            │     (Just passes events)       │                  │
│            └──────────────┬─────────────────┘                  │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         ▼                 ▼                 ▼                  │
│    ┌─────────┐       ┌─────────┐       ┌─────────┐            │
│    │Service A│       │Service B│       │Service C│            │
│    └─────────┘       └─────────┘       └─────────┘            │
│                                                                 │
│    ❌ No one knows overall state                               │
│    ❌ No sequence enforcement                                  │
│    ❌ No compensation on failure                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CAMUNDA AS EVENT BUS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│            ┌────────────────────────────────┐                  │
│            │     CAMUNDA WORKFLOW ENGINE    │                  │
│            │     (Tracks state + sequence)  │                  │
│            │  ┌──────────────────────────┐  │                  │
│            │  │ Task 1: ✅ Complete      │  │                  │
│            │  │ Task 2: 🔄 In Progress   │  │                  │
│            │  │ Task 3: ⏳ Pending       │  │                  │
│            │  └──────────────────────────┘  │                  │
│            └──────────────┬─────────────────┘                  │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         ▼                 ▼                 ▼                  │
│    ┌─────────┐       ┌─────────┐       ┌─────────┐            │
│    │Worker A │       │Worker B │       │Worker C │            │
│    │(listens)│       │(listens)│       │(listens)│            │
│    └─────────┘       └─────────┘       └─────────┘            │
│                                                                 │
│    ✅ Camunda manages overall state                            │
│    ✅ Enforces business sequence                               │
│    ✅ Handles errors and compensation                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Advantages of Camunda as Event Bus

```
1. STATE MANAGEMENT
   └── Camunda knows exactly where each process is

2. SEQUENCE ENFORCEMENT  
   └── Tasks execute in business-defined order

3. ERROR NOTIFICATION
   └── If any task fails, Camunda notifies immediately

4. VISIBILITY
   └── Dashboard shows all process instances

5. FLEXIBILITY
   └── Different workflows for different clients
```

---

## External Task Pattern (18:00 - 26:00)

### How External Tasks Work

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL TASK PATTERN                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. WORKFLOW REACHES SERVICE TASK                              │
│     ┌─────────────────────────────────┐                        │
│     │  [Service Task: "creditCheck"]  │                        │
│     │   type: external                │                        │
│     │   topic: "credit-check-topic"   │                        │
│     └─────────────────────────────────┘                        │
│                    │                                            │
│                    ▼                                            │
│  2. TASK ADDED TO QUEUE                                        │
│     ┌─────────────────────────────────┐                        │
│     │     CAMUNDA TASK QUEUE          │                        │
│     │  ┌───────────────────────────┐  │                        │
│     │  │ Topic: credit-check-topic │  │                        │
│     │  │ Task ID: abc-123          │  │                        │
│     │  │ Variables: {customerId}   │  │                        │
│     │  └───────────────────────────┘  │                        │
│     └─────────────────────────────────┘                        │
│                    │                                            │
│                    ▼                                            │
│  3. WORKER POLLS FOR TASKS                                     │
│     ┌─────────────────────────────────┐                        │
│     │     EXTERNAL TASK WORKER        │                        │
│     │  subscribe("credit-check-topic")│                        │
│     │  └── fetchAndLock()            │                        │
│     │  └── Execute business logic    │                        │
│     │  └── complete() or fail()      │                        │
│     └─────────────────────────────────┘                        │
│                    │                                            │
│                    ▼                                            │
│  4. WORKFLOW CONTINUES                                         │
│     ┌─────────────────────────────────┐                        │
│     │  [Next Task in Workflow]        │                        │
│     └─────────────────────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Node.js External Task Worker

```javascript
const { Client, logger } = require("camunda-external-task-client-js");

// Configuration
const config = {
  baseUrl: "http://localhost:8080/engine-rest",
  use: logger,
  asyncResponseTimeout: 10000
};

// Create client
const client = new Client(config);

// Subscribe to topic: "credit-check"
client.subscribe("credit-check", async function({ task, taskService }) {
  
  // Get variables from workflow
  const customerId = task.variables.get("customerId");
  const loanAmount = task.variables.get("loanAmount");
  
  try {
    // Execute business logic
    const creditScore = await creditService.checkScore(customerId);
    const approved = creditScore > 700 && loanAmount < 50000;
    
    // Complete task with result variables
    await taskService.complete(task, {
      creditScore: creditScore,
      creditApproved: approved,
      checkDate: new Date().toISOString()
    });
    
    console.log(`Credit check completed for ${customerId}: ${approved}`);
    
  } catch (error) {
    // Handle failure - Camunda will retry based on config
    await taskService.handleFailure(task, {
      errorMessage: error.message,
      errorDetails: error.stack,
      retries: task.retries - 1,
      retryTimeout: 5000 // Retry after 5 seconds
    });
  }
});

// Subscribe to another topic
client.subscribe("send-notification", async function({ task, taskService }) {
  const email = task.variables.get("customerEmail");
  const status = task.variables.get("loanStatus");
  
  await emailService.send(email, `Loan ${status}`);
  await taskService.complete(task);
});

console.log("Worker started - listening for tasks...");
```

### Java External Task Worker

```java
@Component
public class PaymentWorker {

    @Autowired
    private PaymentService paymentService;

    @ExternalTaskSubscription("process-payment")
    public void handlePayment(ExternalTask task, ExternalTaskService service) {
        
        String orderId = task.getVariable("orderId");
        Double amount = task.getVariable("amount");
        
        try {
            PaymentResult result = paymentService.process(orderId, amount);
            
            Map<String, Object> variables = new HashMap<>();
            variables.put("paymentId", result.getPaymentId());
            variables.put("paymentStatus", result.getStatus());
            
            service.complete(task, variables);
            
        } catch (PaymentException e) {
            service.handleBpmnError(task, "PAYMENT_FAILED", e.getMessage());
        }
    }
}
```

---

## Multi-Client Workflow Architecture (26:00 - 32:00)

### The Challenge

Different clients need different workflow processes:
- Client A: Simple 3-step approval
- Client B: Complex 7-step with parallel tasks
- Client C: 5-step with human review

### The Solution

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-CLIENT WORKFLOWS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    CAMUNDA ENGINE                       │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │            WORKFLOW DEFINITIONS                  │   │   │
│  │  │                                                  │   │   │
│  │  │  ┌────────────────────────────────────────────┐ │   │   │
│  │  │  │ client-a-process.bpmn                      │ │   │   │
│  │  │  │ ●──▶[Submit]──▶[Review]──▶[Approve]──▶●    │ │   │   │
│  │  │  └────────────────────────────────────────────┘ │   │   │
│  │  │                                                  │   │   │
│  │  │  ┌────────────────────────────────────────────┐ │   │   │
│  │  │  │ client-b-process.bpmn                      │ │   │   │
│  │  │  │ ●──▶[Submit]──▶[Validate]──┬──▶[Legal]──┐  │ │   │   │
│  │  │  │                            └──▶[Tech]───┴▶● │ │   │   │
│  │  │  └────────────────────────────────────────────┘ │   │   │
│  │  │                                                  │   │   │
│  │  │  ┌────────────────────────────────────────────┐ │   │   │
│  │  │  │ client-c-process.bpmn                      │ │   │   │
│  │  │  │ ●──▶[Submit]──▶[AI Check]──▶[Human]──▶●    │ │   │   │
│  │  │  └────────────────────────────────────────────┘ │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SHARED WORKER POOL                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ Submit   │  │ Validate │  │ Notify   │              │   │
│  │  │ Worker   │  │ Worker   │  │ Worker   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  │                                                         │   │
│  │  Workers handle tasks from ANY client's workflow       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Starting Client-Specific Workflow

```javascript
// Workflow Service - starts appropriate workflow per client

async function startProject(clientId, projectData) {
  // Get client's workflow configuration
  const client = await clientService.getById(clientId);
  const workflowKey = client.workflowDefinitionKey; // e.g., "client-a-process"
  
  // Start the workflow
  const response = await camundaClient.post(
    `/process-definition/key/${workflowKey}/start`,
    {
      variables: {
        clientId: { value: clientId, type: "String" },
        projectId: { value: projectData.id, type: "String" },
        projectName: { value: projectData.name, type: "String" },
        submittedBy: { value: projectData.userId, type: "String" }
      },
      businessKey: `project-${projectData.id}`
    }
  );
  
  return response.data;
}
```

---

## Integration Patterns (32:00 - 38:00)

### Pattern 1: REST API Integration

```javascript
// Start workflow via REST
POST /engine-rest/process-definition/key/order-process/start
{
  "variables": {
    "orderId": {"value": "ORD-123", "type": "String"},
    "amount": {"value": 99.99, "type": "Double"}
  },
  "businessKey": "order-ORD-123"
}

// Query workflow status
GET /engine-rest/process-instance?businessKey=order-ORD-123

// Send message to workflow
POST /engine-rest/message
{
  "messageName": "PaymentReceived",
  "businessKey": "order-ORD-123",
  "processVariables": {
    "paymentId": {"value": "PAY-456", "type": "String"}
  }
}
```

### Pattern 2: Message Correlation

```
WAITING WORKFLOW:
●──▶[Create Order]──▶[Wait for Payment]──▶[Ship]──▶●
                            │
                     (Message Catch Event)
                     Waiting for: "PaymentReceived"

EXTERNAL SYSTEM:
Payment Gateway ──▶ Webhook ──▶ Your API ──▶ Camunda Message API
                                              │
                                              ▼
                                     Correlates message to
                                     waiting workflow instance
```

### Pattern 3: Compensation / Saga

```xml
<bpmn:subProcess id="order-saga" triggeredByEvent="false">
  
  <bpmn:serviceTask id="reserve-inventory" name="Reserve Inventory">
    <bpmn:extensionElements>
      <camunda:compensationActivity>
        <camunda:serviceTask name="Release Inventory"/>
      </camunda:compensationActivity>
    </bpmn:extensionElements>
  </bpmn:serviceTask>
  
  <bpmn:serviceTask id="charge-payment" name="Charge Payment">
    <bpmn:extensionElements>
      <camunda:compensationActivity>
        <camunda:serviceTask name="Refund Payment"/>
      </camunda:compensationActivity>
    </bpmn:extensionElements>
  </bpmn:serviceTask>
  
  <bpmn:boundaryEvent attachedTo="order-saga">
    <bpmn:compensateEventDefinition/>
  </bpmn:boundaryEvent>
  
</bpmn:subProcess>
```

---

## Summary (38:00 - 40:00)

### Architecture Components

```
1. FRONTEND
   └── User interface sending actions

2. WORKFLOW SERVICE  
   └── Bridge between app and Camunda

3. CAMUNDA ENGINE
   └── Executes BPMN, manages state

4. EXTERNAL TASK WORKERS
   └── Execute actual business logic

5. MICROSERVICES
   └── Domain services
```

### Key Patterns

```
1. EXTERNAL TASK PATTERN
   └── Workers poll for tasks, execute, complete

2. MESSAGE CORRELATION
   └── Wait for external events

3. MULTI-CLIENT WORKFLOWS
   └── Different BPMN per client, shared workers

4. SAGA / COMPENSATION
   └── Automatic rollback on failure
```

---

**Next Module:** Popular Tools Comparison

---

*Module 5 Complete - Code with TK Sharma*
