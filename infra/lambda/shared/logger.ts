import { Context } from 'aws-lambda';

// Dependency-free structured logger: one JSON line per call on stdout, so CloudWatch Logs Insights can
// filter on fields such as orgId, sessionId, connectionId and errorName.
// Never pass request bodies or tokens as fields.

type Level = 'INFO' | 'WARN' | 'ERROR';
export type LogFields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, error?: unknown, fields?: LogFields): void;
}

function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, errorStack: error.stack };
  }
  return error === undefined ? {} : { errorName: 'NonError', errorMessage: String(error) };
}

export function createLogger(context?: Pick<Context, 'awsRequestId'>, baseFields: LogFields = {}): Logger {
  const write = (level: Level, message: string, fields: LogFields) => {
    const line = JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      awsRequestId: context?.awsRequestId,
      ...baseFields,
      ...fields,
    });
    // Write directly rather than via console so the Lambda runtime does not prefix the JSON
    // with its own tab-separated timestamp/requestId/level text.
    process.stdout.write(`${line}\n`);
  };

  return {
    info: (message, fields = {}) => write('INFO', message, fields),
    warn: (message, fields = {}) => write('WARN', message, fields),
    error: (message, error, fields = {}) => write('ERROR', message, { ...fields, ...errorFields(error) }),
  };
}
