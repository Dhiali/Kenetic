export const isValidEmail = (value: string) => /.+@.+\..+/.test(value);

export const isNonEmpty = (value: string) => value.trim().length > 0;
