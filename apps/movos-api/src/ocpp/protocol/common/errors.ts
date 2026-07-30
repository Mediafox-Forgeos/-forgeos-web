export class CapabilityNotSupportedError extends Error {
  constructor(commandType: string, protocolVersion: string) {
    super(`${commandType} is not supported by the ${protocolVersion} adapter`);
    this.name = 'CapabilityNotSupportedError';
  }
}
