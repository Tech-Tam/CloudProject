import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// Table name comes from an environment variable (set in template.yaml),
// so no value is hardcoded in the code.
const TABLE_NAME = process.env.TABLE_NAME;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient());

const PRIORITIES = ["low", "medium", "high"];
const MAX_NAME_LENGTH = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

// An error we throw on purpose, with the HTTP status the client should get.
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const respond = (statusCode, body) => ({
  statusCode,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  try {
    const parsed = JSON.parse(event.body || "{}");
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
};

// ---- Validation helpers (each throws HttpError 400 on bad input) ----
const validName = (name) => {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new HttpError(400, "'name' is required and must be a non-empty string.");
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    throw new HttpError(400, `'name' must be at most ${MAX_NAME_LENGTH} characters.`);
  }
  return name.trim();
};

const validCompleted = (completed) => {
  if (typeof completed !== "boolean") {
    throw new HttpError(400, "'completed' must be true or false.");
  }
  return completed;
};

const validPriority = (priority) => {
  if (!PRIORITIES.includes(priority)) {
    throw new HttpError(400, `'priority' must be one of: ${PRIORITIES.join(", ")}.`);
  }
  return priority;
};

const validId = (id) => {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new HttpError(400, "'id' is required.");
  }
  return id.trim();
};

// ---- Route handlers ----
const handleGet = async () => {
  // Scan reads the whole table (max 1 MB per call), so loop until done.
  // Fine for a small demo app; a big table would need Query + an index.
  const items = [];
  let lastKey;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey: lastKey })
    );
    items.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return respond(200, items);
};

const handlePost = async (event) => {
  const body = parseBody(event);

  const task = {
    id: randomUUID(),
    name: validName(body.name),
    completed: body.completed === undefined ? false : validCompleted(body.completed),
    priority: body.priority === undefined ? "low" : validPriority(body.priority),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: task }));

  return respond(201, { message: "Task created successfully", task });
};

const handlePatch = async (event) => {
  const body = parseBody(event);
  const id = validId(body.id);

  // Only update the fields the client actually sent.
  const names = {};
  const values = {};
  const sets = [];

  if (body.name !== undefined) {
    names["#name"] = "name"; // "name" is a DynamoDB reserved word
    values[":name"] = validName(body.name);
    sets.push("#name = :name");
  }
  if (body.completed !== undefined) {
    values[":completed"] = validCompleted(body.completed);
    sets.push("completed = :completed");
  }
  if (body.priority !== undefined) {
    values[":priority"] = validPriority(body.priority);
    sets.push("priority = :priority");
  }

  if (sets.length === 0) {
    throw new HttpError(400, "Send at least one of: name, completed, priority.");
  }

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        // Without this, updating a missing id would silently create a new item.
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      })
    );
    return respond(200, { message: "Task updated successfully", task: result.Attributes });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      throw new HttpError(404, "Task not found.");
    }
    throw err;
  }
};

const handleDelete = async (event) => {
  const body = parseBody(event);
  const id = validId(body.id);

  try {
    const result = await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_OLD",
      })
    );
    return respond(200, { message: "Task deleted successfully", task: result.Attributes });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      throw new HttpError(404, "Task not found.");
    }
    throw err;
  }
};

// ---- Entry point ----
export const handler = async (event) => {
  try {
    switch (event.httpMethod) {
      case "OPTIONS":
        return respond(200, { message: "CORS preflight" });
      case "GET":
        return await handleGet();
      case "POST":
        return await handlePost(event);
      case "PATCH":
        return await handlePatch(event);
      case "DELETE":
        return await handleDelete(event);
      default:
        return respond(405, { error: "Method not allowed." });
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return respond(err.statusCode, { error: err.message });
    }
    // Unexpected error: log the details to CloudWatch, but send the
    // client a generic message so internals are not leaked.
    console.error("Unhandled error:", err);
    return respond(500, { error: "Internal server error." });
  }
};
