export interface ServerEnvironment {
  mongoUri: string;
  port: number;
  staticRoot: string;
}

export function readEnvironment(
  values: NodeJS.ProcessEnv = process.env,
  workingDirectory = process.cwd(),
): ServerEnvironment {
  const rawPort = values['PORT'] ?? '8080';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const mongoUri = values['MONGO_URI']?.trim() || 'mongodb://localhost:27017/battle-forge';
  const staticRoot = values['STATIC_ROOT']?.trim() || `${workingDirectory}/public`;
  return { mongoUri, port, staticRoot };
}
