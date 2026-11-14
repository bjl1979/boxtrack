export class DuplicateBoxNumberError extends Error {
  constructor(public readonly number: number) {
    super(`Box ${number} already exists in this move`);
    this.name = 'DuplicateBoxNumberError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
