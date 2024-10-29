import { config, createLogger, format, transports } from "winston";
const { combine, timestamp, json, prettyPrint, splat } = format;

const logger = createLogger({
  level: "info",
  format: combine(timestamp(), json(), prettyPrint()),
  transports: [
    new transports.Console({
      format: format.combine(json(), timestamp(), splat()),
    }),
  ],
});

export default logger;
