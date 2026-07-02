# Pattern 11: Container-Based Deployment

## What is it?

Package each microservice in a container for consistent, portable deployment across environments.

---

## Key Concepts

### Containers vs VMs

| Aspect    | Containers    | Virtual Machines |
| --------- | ------------- | ---------------- |
| Startup   | Seconds       | Minutes          |
| Size      | MBs           | GBs              |
| Isolation | Process-level | Full OS          |
| Overhead  | Low           | High             |

---

## Tools

### Container Runtime

- **Docker** - Most popular container platform
- **containerd** - Lightweight runtime
- **Podman** - Daemonless alternative

### Orchestration

- **Kubernetes** - Industry standard
- **Docker Swarm** - Simpler option
- **Amazon ECS** - AWS managed

---

## Why Popular?

✅ **Consistent environments** - Same container runs everywhere  
✅ **Easy scaling** - Spin up more containers instantly  
✅ **Rolling deployments** - Zero-downtime updates  
✅ **Resource efficiency** - Better utilization than VMs  
✅ **Isolation** - Each service in its own container

---

## Container Best Practices

### Image Building

- Use multi-stage builds
- Minimize image size
- Use specific version tags
- Scan for vulnerabilities

### Runtime

- One process per container
- Use health checks
- Set resource limits
- Don't run as root

---

## Deployment Strategies

| Strategy       | Description                       | Risk            |
| -------------- | --------------------------------- | --------------- |
| **Rolling**    | Replace instances gradually       | Low             |
| **Blue/Green** | Switch traffic to new version     | Medium          |
| **Canary**     | Route % of traffic to new version | Low             |
| **Recreate**   | Stop old, start new               | High (downtime) |

---

## Kubernetes Basics

### Key Resources

- **Pod** - Smallest deployable unit
- **Deployment** - Manages pod replicas
- **Service** - Network access to pods
- **Ingress** - External access rules

### Scaling

- **HPA** - Horizontal Pod Autoscaler (scale by CPU/memory)
- **VPA** - Vertical Pod Autoscaler (resize pods)
- **KEDA** - Event-driven autoscaling

---

## Key Takeaways

- **Containers** = portable, consistent deployments
- **Docker** for building, **Kubernetes** for orchestrating
- Use **rolling/canary** for safe deployments
- Set **resource limits** and **health checks**

---

## 📊 Eraser.io Diagram Code

```eraser
// Container Deployment Architecture
Developer [icon: user, color: blue]
Docker Registry [icon: package, color: orange]

Kubernetes Cluster [icon: cloud, color: purple] {
  Node 1 [icon: server] {
    Pod A [icon: box, color: green]
    Pod B [icon: box, color: green]
  }
  Node 2 [icon: server] {
    Pod C [icon: box, color: green]
    Pod D [icon: box, color: green]
  }
}

Load Balancer [icon: git-branch, color: blue]
Users [icon: users]

Developer --> Docker Registry: Push image
Docker Registry --> Kubernetes Cluster: Pull image
Users --> Load Balancer: Traffic
Load Balancer --> Kubernetes Cluster: Route
```

```eraser
// Rolling Deployment
Old Version v1 [icon: box, color: red]
Old Version v1 Copy [icon: box, color: red]
New Version v2 [icon: box, color: green]
New Version v2 Copy [icon: box, color: green]

Old Version v1 --> New Version v2: Replace 1
Old Version v1 Copy --> New Version v2 Copy: Replace 2
```

```eraser
// Canary Deployment
Load Balancer [icon: git-branch, color: blue]
Stable v1 [icon: box, color: green]
Stable v1 Copy [icon: box, color: green]
Stable v1 Third [icon: box, color: green]
Canary v2 [icon: box, color: orange]

Load Balancer --> Stable v1: 90% traffic
Load Balancer --> Canary v2: 10% traffic
```

---

## 🎬 Video Script: Container Deployment for Microservices

### INTRO (0:00 - 0:30)

**[ON SCREEN: Title card - "Container-Based Deployment Pattern"]**

> "Hey developers! Today we're diving into one of the most important patterns in modern microservices - Container-Based Deployment.
>
> If you've ever heard 'it works on my machine' - containers solve that problem. Let's see how."

---

### SECTION 1: What Are Containers? (0:30 - 2:00)

**[ON SCREEN: Container vs VM comparison diagram]**

> "Think of a container as a lightweight, portable box that contains everything your app needs to run - code, runtime, libraries, and configs.
>
> Unlike virtual machines that need a full operating system, containers share the host OS kernel. This makes them:
>
> - **Fast** - Start in seconds, not minutes
> - **Lightweight** - MBs instead of GBs
> - **Portable** - Same container runs everywhere
>
> The most popular tool? **Docker**. It packages your microservice into an image that can run anywhere Docker is installed."

**[ON SCREEN: Show Dockerfile example]**

> "Here's a simple Dockerfile for a Node.js service. We start from a base image, copy our code, install dependencies, and define how to run it. That's it!"

---

### SECTION 2: Why Kubernetes? (2:00 - 4:00)

**[ON SCREEN: Kubernetes architecture diagram]**

> "Docker is great for running one container. But microservices means dozens, maybe hundreds of containers. How do you manage all that?
>
> Enter **Kubernetes** - the industry standard for container orchestration.
>
> Kubernetes handles:
>
> - **Scheduling** - Where should each container run?
> - **Scaling** - Need more instances? Kubernetes spins them up
> - **Self-healing** - Container crashed? Kubernetes restarts it
> - **Load balancing** - Traffic distributed automatically
> - **Rolling updates** - Deploy without downtime

**[ON SCREEN: kubectl commands]**

> "With one command, you can scale from 3 to 10 instances:
> `kubectl scale deployment orders --replicas=10`
>
> Kubernetes does the rest."

---

### SECTION 3: Deployment Strategies (4:00 - 6:30)

**[ON SCREEN: Deployment strategies comparison]**

> "Now the critical question - HOW do you deploy new versions without breaking things?"

#### Rolling Deployment

> "**Rolling deployment** is the default in Kubernetes. It gradually replaces old pods with new ones.
>
> If you have 4 instances, it might:
>
> 1. Start 1 new pod
> 2. Wait for it to be healthy
> 3. Terminate 1 old pod
> 4. Repeat until all are updated
>
> Zero downtime, but both versions run simultaneously during the rollout."

**[ON SCREEN: Rolling deployment animation]**

#### Blue/Green Deployment

> "**Blue/Green** keeps two identical environments. Blue is production, Green is the new version.
>
> Once Green is tested and ready, you flip the switch - all traffic moves from Blue to Green instantly.
>
> Pros? Easy rollback - just switch back to Blue.
> Cons? You need double the infrastructure."

**[ON SCREEN: Blue/Green switch animation]**

#### Canary Deployment

> "**Canary deployment** is my favorite for high-risk changes.
>
> You route just 5-10% of traffic to the new version. Monitor it. If metrics look good, increase to 25%, then 50%, then 100%.
>
> If something breaks? Only a small percentage of users are affected, and you can rollback immediately."

**[ON SCREEN: Canary traffic split animation]**

---

### SECTION 4: Best Practices (6:30 - 8:00)

**[ON SCREEN: Best practices checklist]**

> "Before you go, here are critical best practices:
>
> **1. One process per container** - Don't stuff multiple services in one container
>
> **2. Use health checks** - Kubernetes needs to know if your app is alive and ready
>
> **3. Set resource limits** - Prevent one service from eating all CPU/memory
>
> **4. Don't run as root** - Security matters
>
> **5. Use multi-stage builds** - Keep your images small
>
> **6. Tag your images properly** - Never use 'latest' in production"

---

### SECTION 5: Quick Demo Recap (8:00 - 9:00)

**[ON SCREEN: Terminal with commands]**

> "Let's recap the workflow:
>
> 1. Write your Dockerfile
> 2. Build the image: `docker build -t my-service:v1 .`
> 3. Push to registry: `docker push my-service:v1`
> 4. Deploy to Kubernetes: `kubectl apply -f deployment.yaml`
> 5. Check status: `kubectl rollout status deployment/my-service`
>
> That's container deployment in a nutshell!"

---

### OUTRO (9:00 - 9:30)

**[ON SCREEN: Subscribe + Next video teaser]**

> "Containers and Kubernetes are essential skills for any microservices developer in 2026.
>
> In the next video, we'll cover **Serverless Microservices** - when you don't want to manage containers at all.
>
> Like, subscribe, and I'll see you in the next one!"

---

### 📝 Video Notes

| Timestamp | Topic                 |
| --------- | --------------------- |
| 0:00      | Intro                 |
| 0:30      | What are containers?  |
| 2:00      | Why Kubernetes?       |
| 4:00      | Deployment strategies |
| 6:30      | Best practices        |
| 8:00      | Quick demo            |
| 9:00      | Outro                 |

**Estimated Duration:** 9-10 minutes
