export type SignupValues = {
  name: string;
  surname: string;
  email: string;
  password: string;
  termsAccepted: boolean;
};

export type SignupErrors = Partial<Record<keyof SignupValues | "form", string>>;

export function validateSignup(values: SignupValues): SignupErrors {
  const errors: SignupErrors = {};
  const name = values.name.trim();
  const surname = values.surname.trim();
  const email = values.email.trim().toLowerCase();

  if (!name) errors.name = "Enter your first name.";
  else if (!/^[\p{L}][\p{L}' -]{1,49}$/u.test(name)) {
    errors.name = "Use 2-50 letters, spaces, apostrophes, or hyphens.";
  }

  if (!surname) errors.surname = "Enter your surname.";
  else if (!/^[\p{L}][\p{L}' -]{1,49}$/u.test(surname)) {
    errors.surname = "Use 2-50 letters, spaces, apostrophes, or hyphens.";
  }

  if (!email) errors.email = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "Enter a valid email with @ and a domain.";
  }

  if (!values.password) errors.password = "Create a password.";
  else if (values.password.length < 8) {
    errors.password = "Use at least 8 characters.";
  } else if (!/[A-Z]/.test(values.password)) {
    errors.password = "Add at least one capital letter.";
  } else if (!/[a-z]/.test(values.password)) {
    errors.password = "Add at least one lowercase letter.";
  } else if (!/[0-9]/.test(values.password)) {
    errors.password = "Add at least one number.";
  } else if (!/[^A-Za-z0-9]/.test(values.password)) {
    errors.password = "Add at least one special character.";
  }

  if (!values.termsAccepted) {
    errors.termsAccepted = "Agree to the terms to continue.";
  }

  return errors;
}
