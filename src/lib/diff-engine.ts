import type { ParsedAction, ParsedField } from './types.js';

export type ChangeType = 'breaking' | 'non-breaking';

export interface DiffChange {
  type: ChangeType;
  category: string;
  message: string;
  method?: string;
  path?: string;
}

export interface DiffResult {
  changes: DiffChange[];
  breakingCount: number;
  nonBreakingCount: number;
}

/**
 * Compare two sets of parsed actions and classify changes.
 */
export function diffSpecs(
  oldActions: ParsedAction[],
  newActions: ParsedAction[]
): DiffResult {
  const changes: DiffChange[] = [];

  const oldMap = new Map<string, ParsedAction>();
  for (const a of oldActions) {
    oldMap.set(`${a.method} ${a.path}`, a);
  }

  const newMap = new Map<string, ParsedAction>();
  for (const a of newActions) {
    newMap.set(`${a.method} ${a.path}`, a);
  }

  // Removed endpoints (breaking)
  for (const [key, oldAction] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        type: 'breaking',
        category: 'endpoint-removed',
        message: `Endpoint removed: ${oldAction.method} ${oldAction.path}`,
        method: oldAction.method,
        path: oldAction.path,
      });
    }
  }

  // Added endpoints (non-breaking)
  for (const [key, newAction] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        type: 'non-breaking',
        category: 'endpoint-added',
        message: `Endpoint added: ${newAction.method} ${newAction.path}`,
        method: newAction.method,
        path: newAction.path,
      });
    }
  }

  // Modified endpoints
  for (const [key, newAction] of newMap) {
    const oldAction = oldMap.get(key);
    if (!oldAction) continue;

    compareEndpoints(oldAction, newAction, changes);
  }

  return {
    changes,
    breakingCount: changes.filter((c) => c.type === 'breaking').length,
    nonBreakingCount: changes.filter((c) => c.type === 'non-breaking').length,
  };
}

function compareEndpoints(
  oldAction: ParsedAction,
  newAction: ParsedAction,
  changes: DiffChange[]
): void {
  const method = newAction.method;
  const path = newAction.path;

  // Required params added (breaking)
  const oldRequiredParams = new Set(
    [...oldAction.queryParams, ...oldAction.pathParams]
      .filter((p) => p.required)
      .map((p) => p.key)
  );
  const newRequiredParams = [
    ...newAction.queryParams,
    ...newAction.pathParams,
  ].filter((p) => p.required);

  for (const param of newRequiredParams) {
    if (!oldRequiredParams.has(param.key)) {
      changes.push({
        type: 'breaking',
        category: 'required-param-added',
        message: `Required parameter added: "${param.key}" on ${method} ${path}`,
        method,
        path,
      });
    }
  }

  // Optional params added (non-breaking)
  const oldAllParams = new Set(
    [...oldAction.queryParams, ...oldAction.pathParams].map((p) => p.key)
  );
  const newOptionalParams = [
    ...newAction.queryParams,
    ...newAction.pathParams,
  ].filter((p) => !p.required);

  for (const param of newOptionalParams) {
    if (!oldAllParams.has(param.key)) {
      changes.push({
        type: 'non-breaking',
        category: 'optional-param-added',
        message: `Optional parameter added: "${param.key}" on ${method} ${path}`,
        method,
        path,
      });
    }
  }

  // Params removed (breaking)
  const newAllParams = new Set(
    [...newAction.queryParams, ...newAction.pathParams].map((p) => p.key)
  );
  for (const key of oldAllParams) {
    if (!newAllParams.has(key)) {
      changes.push({
        type: 'breaking',
        category: 'param-removed',
        message: `Parameter removed: "${key}" from ${method} ${path}`,
        method,
        path,
      });
    }
  }

  // Param type changes (breaking)
  const oldParamMap = new Map<string, ParsedField>();
  for (const p of [...oldAction.queryParams, ...oldAction.pathParams]) {
    oldParamMap.set(p.key, p);
  }
  for (const p of [...newAction.queryParams, ...newAction.pathParams]) {
    const old = oldParamMap.get(p.key);
    if (old && old.type !== p.type) {
      changes.push({
        type: 'breaking',
        category: 'param-type-changed',
        message: `Parameter type changed: "${p.key}" ${old.type} -> ${p.type} on ${method} ${path}`,
        method,
        path,
      });
    }
  }

  // Required body fields added (breaking)
  const oldBodyKeys = new Set(oldAction.bodySchema.map((f) => f.key));
  for (const field of newAction.bodySchema) {
    if (field.required && !oldBodyKeys.has(field.key)) {
      changes.push({
        type: 'breaking',
        category: 'required-body-field-added',
        message: `Required body field added: "${field.key}" on ${method} ${path}`,
        method,
        path,
      });
    }
  }

  // Response fields removed (breaking)
  const newResponseKeys = new Set(newAction.responseSchema.map((f) => f.key));
  for (const field of oldAction.responseSchema) {
    if (!newResponseKeys.has(field.key)) {
      changes.push({
        type: 'breaking',
        category: 'response-field-removed',
        message: `Response field removed: "${field.key}" from ${method} ${path}`,
        method,
        path,
      });
    }
  }

  // Description changes (non-breaking)
  if (
    oldAction.description !== newAction.description &&
    oldAction.description &&
    newAction.description
  ) {
    changes.push({
      type: 'non-breaking',
      category: 'description-changed',
      message: `Description changed on ${method} ${path}`,
      method,
      path,
    });
  }
}
