class BusinessError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.status = status;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status
    };
  }
}

module.exports = { BusinessError };
