# Template Improvements Guide

This document outlines the key improvements made to the MCP Server Template for better developer experience, security, testing, and observability.

## 1. Typed Tool Definition System with Runtime Validation

### Overview
A robust, type-safe tool definition system using TypeBox schemas that provides single-source-of-truth for tool parameters and output, automatic runtime validation, and intellisense support.

### Key Features
- **Schema-Driven**: Uses TypeBox for JSON Schema definition
- **Type-Safe**: TypeScript types are automatically inferred from schemas
- **Runtime Validation**: Automatic input/output validation before/after execution
- **Self-Documenting**: Schemas serve as documentation
- **Error Handling**: Clear validation error messages

### Usage Example

```typescript
import { Type } from '@sinclair/typebox';
import { createTypedTool, ToolRegistry } from './src/tools/typed-tool-system.js';

// 1. Define your tool with schemas
const addTool = createTypedTool({
  name: 'add',
  description: 'Adds two numbers together',
  inputSchema: Type.Object({
    a: Type.Number({ description: 'First number' }),
    b: Type.Number({ description: 'Second number' }),
    precision: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
  }),
  outputSchema: Type.Object({
    sum: Type.Number(),
    precise: Type.Optional(Type.Boolean()),
  }),
  handler: async ({ a, b, precision }) => ({
    sum: a + b,
    precise: precision !== undefined,
  }),
  examples: [
    { input: { a: 5, b: 3 }, output: { sum: 8 } },
  ],
  tags: ['math', 'arithmetic'],
});

// 2. Register tools with a registry
const registry = new ToolRegistry();
registry.register(addTool);

// 3. Execute with automatic validation
const result = await registry.execute('add', { a: 5, b: 3 });
// result.success === true
// result.data === { sum: 8, precise: false }

// 4. Get metadata for MCP handshake
const toolMetadata = registry.getMetadata();
```

### Benefits
- ✅ Catches parameter mismatches at runtime
- ✅ Prevents invalid data from reaching handlers
- ✅ Schemas are automatically exposed in MCP metadata
- ✅ Type-safe handler implementations
- ✅ Clear error messages for debugging

### Tests
See `test/tools/typed-tool-system.test.ts` for comprehensive examples.

---

## 2. Sandboxed File Reader with Security

### Overview
A production-ready file reader that enforces security best practices: path traversal protection, extension whitelisting, file size limits, timeouts, and access policies.

### Key Features
- **Path Sandboxing**: Prevents directory traversal and absolute paths
- **Extension Whitelisting**: Only allow specific file types
- **Size Limits**: Prevent reading overly large files
- **Timeout Protection**: Operations timeout after configurable duration
- **Access Policies**: Flexible read/write/execute permissions
- **File Metadata**: Returns modification time, permissions, type info

### Usage Example

```typescript
import { SandboxedFileReader } from './src/tools/sandboxed-file-reader.js';

// 1. Create reader with security settings
const reader = new SandboxedFileReader({
  workspaceRoot: '/home/user/workspace',
  maxFileSize: 1024 * 1024,  // 1MB max
  allowedExtensions: ['.txt', '.json', '.md', '.ts'],
  timeout: 10000,  // 10 second timeout
});

// 2. Read files safely
const result = await reader.readFile('src/main.ts');
if (result.success) {
  console.log(result.data?.content);
  console.log(result.data?.metadata);  // mtime, mode, etc.
} else {
  console.error(result.error);
}

// 3. List directory contents (filtered by extension)
const listResult = await reader.listDirectory('src');
if (listResult.success) {
  console.log(listResult.data?.files);
  console.log(listResult.data?.directories);
}

// 4. Custom access policies
const customReader = new SandboxedFileReader({
  workspaceRoot: '/home/user/workspace',
  policy: {
    canRead: true,
    canWrite: false,
    canExecute: false,
    allowedPaths: ['public/**'],
    deniedPaths: ['private/**', '.env'],
  },
});
```

### Security Properties
- ❌ Cannot read `/etc/passwd` (absolute paths rejected)
- ❌ Cannot read `../../../secret` (traversal blocked)
- ❌ Cannot read `.exe` files (extension filtered)
- ❌ Cannot read >100MB files (size checked)
- ❌ Cannot write files (write access disabled)
- ✅ Can read `.txt`, `.json`, `.md` within workspace

### Tests
See `test/tools/sandboxed-file-reader.test.ts` for 16+ test cases.

---

## 3. Structured Logging with Correlation IDs

### Overview
Production-grade logging system with correlation IDs for request tracing, error categorization, structured fields, and telemetry integration.

### Key Features
- **Correlation IDs**: Track requests across multiple operations
- **Error Categories**: Classify errors for better handling (VALIDATION, SYSTEM, RATE_LIMITED, TIMEOUT, etc.)
- **Structured Fields**: Include context data with every log
- **Tool Execution Tracking**: Automatic duration and status logging
- **Event-Based**: Extensible event emitter for integration with logging services

### Usage Example

```typescript
import {
  StructuredLogger,
  ErrorCategory,
  createCorrelationId,
} from './src/utils/structured-logger.js';

// 1. Create logger per service
const logger = new StructuredLogger('my-mcp-server');

// 2. Set correlation ID for request tracing
const correlationId = createCorrelationId();
logger.setCorrelationId(correlationId);

// 3. Log with context
logger.info('Processing request', {
  userId: user.id,
  action: 'calculate',
  source: 'api',
});

// 4. Log tool execution
logger.logToolExecution({
  toolName: 'process_data',
  duration: 245,  // milliseconds
  success: true,
  statusCode: 200,
});

// 5. Log categorized errors
try {
  validateInput(input);
} catch (error) {
  logger.logError('Validation failed', error, {
    errorCategory: ErrorCategory.VALIDATION,
    toolName: 'calculate',
    input: input,
  });
}

// 6. Subscribe to logs (for external logging services)
logger.on('log', (entry) => {
  console.log(JSON.stringify(entry));
  // Or send to: DataDog, Splunk, CloudWatch, etc.
});
```

### Log Output Example
```json
{
  "timestamp": "2025-11-17T21:50:27.978Z",
  "level": "info",
  "service": "my-mcp-server",
  "message": "Tool execution: calculate",
  "correlationId": "1763416317869-36oir5e62",
  "toolName": "calculate",
  "duration": 245,
  "success": true,
  "statusCode": 200
}
```

### Error Categories
- **VALIDATION**: Input validation failed
- **SYSTEM**: System/OS error (file not found, permission denied, etc.)
- **RATE_LIMITED**: Rate limit exceeded (includes `retryAfter`)
- **TIMEOUT**: Operation timed out (includes `duration`)
- **UNSUPPORTED**: Feature not supported
- **UNKNOWN**: Uncategorized error

### Tests
See `test/utils/structured-logger.test.ts` for 11+ test cases.

---

## 4. Best Practices for Using Improvements

### Combining Typed Tools + Structured Logging

```typescript
import { createTypedTool, ToolRegistry } from './src/tools/typed-tool-system.js';
import { StructuredLogger, ErrorCategory } from './src/utils/structured-logger.js';
import { Type } from '@sinclair/typebox';

const logger = new StructuredLogger('my-mcp-server');

// Create tool with automatic validation
const processDataTool = createTypedTool({
  name: 'process_data',
  description: 'Processes structured data',
  inputSchema: Type.Object({
    data: Type.Array(Type.Object({
      id: Type.String(),
      value: Type.Number({ minimum: 0 }),
    })),
  }),
  outputSchema: Type.Object({
    processed: Type.Number(),
    total: Type.Number(),
  }),
  handler: async ({ data }) => {
    logger.info('Processing data', { count: data.length });
    try {
      const processed = data.filter(d => d.value > 0).length;
      logger.logToolExecution({
        toolName: 'process_data',
        duration: 42,
        success: true,
        statusCode: 200,
      });
      return { processed, total: data.length };
    } catch (error) {
      logger.logError('Processing failed', error as Error, {
        errorCategory: ErrorCategory.SYSTEM,
      });
      throw error;
    }
  },
});
```

### Using Sandboxed File Reader in Tools

```typescript
import { createTypedTool } from './src/tools/typed-tool-system.js';
import { SandboxedFileReader } from './src/tools/sandboxed-file-reader.js';
import { Type } from '@sinclair/typebox';

const reader = new SandboxedFileReader({
  workspaceRoot: process.cwd(),
  allowedExtensions: ['.md', '.txt'],
  maxFileSize: 1024 * 100,
});

const readFileTool = createTypedTool({
  name: 'read_file',
  description: 'Safely reads project documentation',
  inputSchema: Type.Object({
    path: Type.String({ description: 'Relative file path' }),
  }),
  outputSchema: Type.Object({
    content: Type.String(),
    size: Type.Number(),
  }),
  handler: async ({ path }) => {
    const result = await reader.readFile(path);
    if (!result.success) {
      throw new Error(result.error);
    }
    return {
      content: result.data!.content,
      size: result.data!.size,
    };
  },
});
```

---

## 5. Integration with MCP Server

### In Your Server Setup

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createTypedTool, ToolRegistry } from './src/tools/typed-tool-system.js';
import { StructuredLogger } from './src/utils/structured-logger.js';

const server = new Server({
  name: 'my-mcp-server',
  version: '1.0.0',
});

const logger = new StructuredLogger('my-mcp-server');
const registry = new ToolRegistry();

// Register your tools
registry.register(myTool1);
registry.register(myTool2);

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: registry.getMetadata().map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
}));

// Handle call tool with logging
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();
  try {
    const result = await registry.execute(request.params.name, request.params.arguments);
    const duration = Date.now() - startTime;

    logger.logToolExecution({
      toolName: request.params.name,
      duration,
      success: result.success,
      statusCode: result.success ? 200 : 400,
    });

    if (result.success) {
      return {
        content: [{ type: 'text', text: JSON.stringify(result.data) }],
      };
    } else {
      return {
        content: [{ type: 'text', text: result.error || 'Error' }],
        isError: true,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logError('Tool execution failed', error as Error, {
      toolName: request.params.name,
      errorCategory: ErrorCategory.SYSTEM,
    });
    throw error;
  }
});

await server.connect(transport);
```

---

## 6. Testing with Improvements

### Testing Typed Tools

```typescript
import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { createTypedTool } from './src/tools/typed-tool-system.js';

describe('my tool', () => {
  it('should validate input and execute', async () => {
    const tool = createTypedTool({
      name: 'test',
      description: 'Test tool',
      inputSchema: Type.Object({
        value: Type.Number({ minimum: 1 }),
      }),
      outputSchema: Type.Object({
        doubled: Type.Number(),
      }),
      handler: async ({ value }) => ({ doubled: value * 2 }),
    });

    // Valid input
    const result = await tool.execute({ value: 5 });
    expect(result.success).toBe(true);
    expect(result.data?.doubled).toBe(10);

    // Invalid input
    const invalidResult = await tool.execute({ value: -1 } as any);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBeDefined();
  });
});
```

### Testing Sandboxed Operations

```typescript
it('should prevent directory traversal', async () => {
  const reader = new SandboxedFileReader({
    workspaceRoot: tempDir,
    allowedExtensions: ['.txt'],
  });

  expect(() => {
    reader.validatePath('../../../etc/passwd');
  }).toThrow(FileSandboxError);
});
```

---

## 7. Troubleshooting

### "Input validation failed" Errors
Check that your input matches the `inputSchema` exactly. Enable debug logging to see validation details.

### "Path traversal outside workspace" Errors
Use relative paths only. Absolute paths and `../` sequences are blocked. Use paths like `file.txt` or `subdir/file.txt`.

### Correlation IDs Not Appearing in Logs
Ensure you call `logger.setCorrelationId()` before logging. For automatic tracking, set it at the beginning of request handling.

### File Size Limits
Adjust `maxFileSize` in SandboxedFileReader config. Default is 10MB. Use this to prevent reading large binary files.

---

## 8. Migration from Old System

If you're upgrading from the previous template:

1. **Old Tool System** → **New Typed Tools**
   - Replace `ToolHandler` with `createTypedTool()`
   - Add TypeBox `inputSchema` and `outputSchema`
   - Remove manual parameter validation
   - Update tests to use new execute API

2. **Old Logging** → **New Structured Logger**
   - Replace console.log with `logger.info()`, `logger.warn()`, etc.
   - Use correlation IDs for request tracking
   - Add error categories to error logs

3. **Old File Reading** → **Sandboxed File Reader**
   - Replace direct `fs.readFile()` calls
   - Use `SandboxedFileReader` for all user file access
   - Benefits: Automatic security checks, size limits, timeout handling

---

## Summary of Improvements

| Feature | Benefit |
|---------|---------|
| **Typed Tool System** | Single source of truth for schemas, automatic validation, type-safety |
| **Sandboxed File Reader** | Security by default, prevents common attacks, file size/timeout limits |
| **Structured Logging** | Better debugging, tracing with correlation IDs, error categorization |
| **Error Categories** | Consistent error handling, client-side retry logic, observability |
| **Built-in Examples** | Clear patterns for secure, testable, observable MCP tools |

These improvements make your MCP servers:
- ✅ **Safer** by default
- ✅ **More testable** with clear contracts
- ✅ **Easier to debug** with structured logging
- ✅ **More maintainable** with type-safe patterns
- ✅ **Production-ready** with observability built-in
