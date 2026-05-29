class ValidationChain {
  validate(result, schema) {
    const errors = [];
    if (!result) errors.push('Result is empty');
    if (schema && typeof result !== schema.type) errors.push(`Result must be ${schema.type}`);
    return { valid: errors.length === 0, errors };
  }
}

module.exports = ValidationChain;
