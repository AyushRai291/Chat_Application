const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];

export const validateEnv = () => {
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required env vars: ${missingEnvVars.join(", ")}`);
  }
};
