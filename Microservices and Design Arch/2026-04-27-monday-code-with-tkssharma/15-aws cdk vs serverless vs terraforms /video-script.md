# AWS CDK vs Serverless Framework vs Terraform - Video Script

## 📹 Video Metadata
- **Title:** AWS CDK vs Serverless Framework vs Terraform - Which IaC Tool Should You Use?
- **Duration:** 18-22 minutes
- **Target Audience:** DevOps engineers, Cloud architects, Backend developers
- **Keywords:** AWS CDK, Serverless Framework, Terraform, Infrastructure as Code, IaC, CloudFormation, HCL, DevOps

---

## 🎬 INTRO (0:00 - 1:30)

### Hook (0:00 - 0:30)
> "You want to deploy your infrastructure as code, but should you use AWS CDK, Serverless Framework, or Terraform? 
> Each tool has passionate advocates, but choosing the WRONG one can cost you months of migration pain.
> In this video, I'll show you exactly when to use each tool, with real code examples and a decision framework."

### Channel Intro (0:30 - 0:45)
> "Hey everyone, welcome back to Code with TKSSharma! 
> If you're new here, I create in-depth tutorials on cloud architecture, microservices, and DevOps.
> Hit subscribe and the bell icon so you don't miss any videos."

### What We'll Cover (0:45 - 1:30)
> "Today we'll cover:
> 1. What each tool is and how it works under the hood
> 2. Real code examples - deploying the SAME infrastructure with all three
> 3. Pros and cons of each approach
> 4. A decision framework to help you choose
> 5. Real-world use cases from companies like Netflix, Uber, and Airbnb
> 
> Let's dive in!"

---

## 📚 SECTION 1: What is Infrastructure as Code? (1:30 - 3:00)

### The Problem (1:30 - 2:15)
> "Before IaC, we had ClickOps - manually clicking through the AWS console.
> Problems with this approach:
> - No version control - who changed what?
> - No reproducibility - 'works on my AWS account'
> - No consistency - dev looks different from prod
> - No automation - manual deployments are slow and error-prone
> 
> Infrastructure as Code solves all of this by treating infrastructure like... code!"

### The Three Contenders (2:15 - 3:00)
> "Today we're comparing three popular IaC tools:
> 
> **AWS CDK** - Write infrastructure in TypeScript, Python, Java, or Go. Compiles to CloudFormation.
> 
> **Serverless Framework** - YAML-based config focused on serverless apps. Also generates CloudFormation.
> 
> **Terraform** - HashiCorp's HCL language. Works with ANY cloud provider.
> 
> Let's understand how each one works."

---

## 🔶 SECTION 2: AWS CDK Deep Dive (3:00 - 6:30)

### What is CDK? (3:00 - 3:45)
> "AWS CDK, or Cloud Development Kit, lets you define AWS infrastructure using real programming languages.
> 
> The magic is that your TypeScript or Python code gets 'synthesized' into CloudFormation templates.
> You get the best of both worlds - real programming language features PLUS CloudFormation's reliability."

### How CDK Works (3:45 - 4:30)
> "Here's the CDK workflow:
> 
> 1. You write code using CDK constructs - these are like building blocks
> 2. Run `cdk synth` - this generates CloudFormation JSON/YAML
> 3. Run `cdk diff` - see what will change
> 4. Run `cdk deploy` - deploys via CloudFormation
> 
> The CloudFormation engine handles the actual resource creation, rollbacks, and state management."

### CDK Construct Levels (4:30 - 5:30)
> "CDK has three levels of constructs:
> 
> **L1 - CFN Resources**: Direct CloudFormation mappings. Maximum control, most verbose.
> 
> **L2 - Intent-based**: Sensible defaults. Like `new lambda.Function()` - sets up IAM roles automatically.
> 
> **L3 - Patterns**: Complete architectures. Like `LambdaRestApi` - creates Lambda, API Gateway, and wires them together.
> 
> Most of the time, you'll use L2 constructs."

### CDK Code Example (5:30 - 6:30)
> "Let's see CDK in action. Here's a Lambda function with API Gateway and DynamoDB:
> 
> ```typescript
> const table = new dynamodb.Table(this, 'UsersTable', {
>   partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
>   billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
> });
> 
> const handler = new lambda.Function(this, 'UserHandler', {
>   runtime: lambda.Runtime.NODEJS_18_X,
>   code: lambda.Code.fromAsset('lambda'),
>   handler: 'users.handler',
>   environment: { TABLE_NAME: table.tableName },
> });
> 
> table.grantReadWriteData(handler);  // This is the magic!
> ```
> 
> Notice that `grantReadWriteData` - CDK automatically creates the IAM policy for you. No more copying IAM JSON!"

---

## ⚡ SECTION 3: Serverless Framework Deep Dive (6:30 - 10:00)

### What is Serverless Framework? (6:30 - 7:15)
> "Serverless Framework is a YAML-based tool specifically designed for serverless applications.
> 
> It was created in 2015 - before AWS CDK even existed - and it's still incredibly popular.
> Over 40,000 GitHub stars and used by companies like Coca-Cola, EA, and Nordstrom."

### How Serverless Works (7:15 - 8:00)
> "The Serverless Framework workflow:
> 
> 1. Define your service in `serverless.yml`
> 2. Run `sls package` - bundles code and generates CloudFormation
> 3. Run `sls deploy` - uploads to S3, deploys via CloudFormation
> 4. Run `sls invoke` - test functions directly
> 5. Run `sls logs` - view CloudWatch logs
> 
> It's optimized for the serverless developer experience."

### Plugin Ecosystem (8:00 - 8:45)
> "One of Serverless Framework's superpowers is its plugin ecosystem.
> 
> Popular plugins include:
> - `serverless-offline` - run Lambda locally
> - `serverless-webpack` - bundle with webpack
> - `serverless-domain-manager` - custom domains
> - `serverless-prune-plugin` - clean up old versions
> 
> There are over 1,000 plugins available!"

### Serverless Code Example (8:45 - 10:00)
> "Here's the same API in Serverless Framework:
> 
> ```yaml
> service: users-api
> 
> provider:
>   name: aws
>   runtime: nodejs18.x
>   environment:
>     USERS_TABLE: ${self:service}-users
>   iam:
>     role:
>       statements:
>         - Effect: Allow
>           Action: [dynamodb:*]
>           Resource: !GetAtt UsersTable.Arn
> 
> functions:
>   createUser:
>     handler: src/users.create
>     events:
>       - http: { path: users, method: post }
>   
>   getUser:
>     handler: src/users.get
>     events:
>       - http: { path: users/{id}, method: get }
> 
> resources:
>   Resources:
>     UsersTable:
>       Type: AWS::DynamoDB::Table
>       Properties:
>         BillingMode: PAY_PER_REQUEST
> ```
> 
> Notice how concise this is. The events section is particularly elegant - just define the path and method."

---

## 🟣 SECTION 4: Terraform Deep Dive (10:00 - 13:30)

### What is Terraform? (10:00 - 10:45)
> "Terraform is HashiCorp's infrastructure as code tool using HCL - HashiCorp Configuration Language.
> 
> The KEY difference: Terraform is truly multi-cloud. 
> AWS, GCP, Azure, Kubernetes, GitHub, Datadog - over 3,000 providers.
> 
> If it has an API, there's probably a Terraform provider for it."

### How Terraform Works (10:45 - 11:30)
> "Terraform's workflow is different:
> 
> 1. Write `.tf` files in HCL
> 2. Run `terraform init` - download providers
> 3. Run `terraform plan` - see what will change
> 4. Run `terraform apply` - create/update resources
> 
> The big difference: Terraform manages its own STATE FILE. 
> This file tracks what resources exist and their current configuration."

### State Management (11:30 - 12:15)
> "State management is critical in Terraform:
> 
> **Local State**: `terraform.tfstate` file. Fine for learning, terrible for teams.
> 
> **Remote State with S3**: Store state in S3 with DynamoDB locking. 
> This prevents two people from applying at the same time.
> 
> **Terraform Cloud**: HashiCorp's managed solution. 
> State management, team collaboration, policy enforcement.
> 
> Always use remote state for production!"

### Terraform Code Example (12:15 - 13:30)
> "Here's infrastructure in Terraform - let's do a VPC with ECS:
> 
> ```hcl
> module "vpc" {
>   source  = "terraform-aws-modules/vpc/aws"
>   name    = "${var.project}-vpc"
>   cidr    = "10.0.0.0/16"
>   azs     = ["us-east-1a", "us-east-1b"]
>   private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
>   public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
>   enable_nat_gateway = true
> }
> 
> resource "aws_ecs_cluster" "main" {
>   name = "${var.project}-cluster"
> }
> 
> resource "aws_ecs_service" "app" {
>   name            = "${var.project}-service"
>   cluster         = aws_ecs_cluster.main.id
>   task_definition = aws_ecs_task_definition.app.arn
>   desired_count   = 2
>   launch_type     = "FARGATE"
> }
> ```
> 
> Notice the module usage - Terraform has a huge registry of reusable modules."

---

## ⚔️ SECTION 5: Head-to-Head Comparison (13:30 - 16:00)

### Language & Learning Curve (13:30 - 14:15)
> "Let's compare them head-to-head:
> 
> **CDK**: Real programming languages. If you know TypeScript, you're 80% there.
> Great IDE support, autocomplete, type checking. Learning curve: Medium.
> 
> **Serverless**: YAML. Easy to read, can get verbose for complex apps.
> Great for serverless-focused teams. Learning curve: Low.
> 
> **Terraform**: HCL. Not quite a programming language, but not YAML either.
> Declarative and consistent. Learning curve: Medium-High."

### Multi-Cloud Support (14:15 - 14:45)
> "Multi-cloud is where they really differ:
> 
> **CDK**: AWS only. Period. There's CDK for Terraform, but that's different.
> 
> **Serverless**: Primarily AWS, but supports Azure Functions and Google Cloud Functions.
> 
> **Terraform**: True multi-cloud. Same tool, same workflow for any provider."

### State Management (14:45 - 15:15)
> "How do they track what exists?
> 
> **CDK**: Uses CloudFormation's state. No state file to manage.
> 
> **Serverless**: Also uses CloudFormation. No state file headaches.
> 
> **Terraform**: You manage state yourself. More control, more responsibility."

### Best Use Cases (15:15 - 16:00)
> "When should you use each?
> 
> **Use CDK when:**
> - You're all-in on AWS
> - You want testable infrastructure
> - Your team knows TypeScript/Python
> - You need complex logic in your infrastructure
> 
> **Use Serverless when:**
> - You're building serverless apps
> - You want fast iteration
> - You're a small team or solo developer
> - You value simplicity over flexibility
> 
> **Use Terraform when:**
> - You need multi-cloud
> - You manage full infrastructure (VPCs, databases, K8s)
> - You need strict compliance and audit trails
> - You're a platform team supporting many projects"

---

## 🎯 SECTION 6: Decision Framework (16:00 - 18:00)

### The Decision Flowchart (16:00 - 17:00)
> "Here's my decision framework:
> 
> **Question 1: Is it AWS only?**
> - NO → Use Terraform
> - YES → Continue
> 
> **Question 2: Is it serverless-focused?**
> - YES → Use Serverless Framework
> - NO → Continue
> 
> **Question 3: Do you need programming language features?**
> - YES → Use CDK
> - NO → Consider Terraform for consistency
> 
> **Question 4: What's your team size?**
> - Solo/Small → Serverless Framework
> - Medium → CDK
> - Large/Enterprise → Terraform or CDK"

### Real-World Examples (17:00 - 18:00)
> "Let me share some real-world scenarios:
> 
> **Startup building a SaaS API**: Serverless Framework. Get to market fast, minimal config.
> 
> **Enterprise migrating to AWS**: CDK. Reusable constructs, testable, familiar languages.
> 
> **Multi-cloud platform team**: Terraform. Consistent tooling across AWS, GCP, and Azure.
> 
> **Compliance-heavy fintech**: Terraform. State tracking, drift detection, audit trails.
> 
> **Solo developer with Lambda**: Serverless Framework. Don't overthink it."

---

## 🏁 SECTION 7: CONCLUSION (18:00 - 19:30)

### Summary (18:00 - 18:45)
> "Let's recap:
> 
> **AWS CDK**: Best for AWS-focused teams who want real programming language power.
> 
> **Serverless Framework**: Best for serverless apps where simplicity matters.
> 
> **Terraform**: Best for multi-cloud, full infrastructure, enterprise teams.
> 
> There's no wrong answer - only wrong fits. Choose based on YOUR team, YOUR use case."

### Call to Action (18:45 - 19:15)
> "Which tool are YOU using? Drop a comment below!
> 
> If this video helped you, smash that like button and subscribe for more cloud architecture content.
> 
> Check out my other videos on serverless patterns and microservices design."

### Outro (19:15 - 19:30)
> "Thanks for watching, and I'll see you in the next one. Happy coding!"

---

## 🎨 Thumbnail Ideas

### Option 1: VS Battle Style
```
[CDK Logo]  VS  [Serverless Logo]  VS  [Terraform Logo]
         "WHICH ONE WINS?"
         Your face looking confused
```

### Option 2: Decision Style
```
"CDK vs Serverless vs Terraform"
"THE ULTIMATE GUIDE"
Arrow pointing to your face with checkmark
```

### Option 3: Code Comparison
```
Split screen showing 3 code snippets
"SAME INFRA - 3 WAYS"
Big red circle around "Which is BEST?"
```

---

## 📝 Video Notes

### B-Roll Suggestions
- AWS Console walkthrough
- Terminal showing cdk deploy, sls deploy, terraform apply
- Architecture diagrams for each tool
- Code editor with syntax highlighting
- CloudFormation stack creation

### Graphics Needed
- CDK workflow diagram
- Serverless Framework workflow
- Terraform workflow with state
- Comparison table animation
- Decision flowchart

### Key Timestamps for Chapters
```
0:00 - Intro
1:30 - What is IaC?
3:00 - AWS CDK Deep Dive
6:30 - Serverless Framework Deep Dive
10:00 - Terraform Deep Dive
13:30 - Head-to-Head Comparison
16:00 - Decision Framework
18:00 - Conclusion
```

---

## 🔗 Resources for Description

- AWS CDK Docs: https://docs.aws.amazon.com/cdk/
- Serverless Framework: https://www.serverless.com/
- Terraform Registry: https://registry.terraform.io/
- CDK Patterns: https://cdkpatterns.com/
- Serverless Stack (SST): https://sst.dev/
