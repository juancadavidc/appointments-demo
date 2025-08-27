import { 
  UserRegistrationSchema, 
  LoginSchema, 
  PasswordSchema, 
  EmailSchema,
  validateEmail,
  validatePassword,
  extractValidationErrors
} from './validation-schemas';
import { z } from 'zod';

describe('Authentication Validation Schemas', () => {
  describe('EmailSchema', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user+tag@domain.co.uk',
        'name.surname@company.org'
      ];
      
      validEmails.forEach(email => {
        expect(() => EmailSchema.parse(email)).not.toThrow();
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid-email',
        'test@',
        '@domain.com',
        'spaces in@email.com'
      ];
      
      invalidEmails.forEach(email => {
        expect(() => EmailSchema.parse(email)).toThrow();
      });
    });

    it('should trim and lowercase emails', () => {
      const result = EmailSchema.parse('  TEST@EXAMPLE.COM  ');
      expect(result).toBe('test@example.com');
    });
  });

  describe('PasswordSchema', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'ValidPass123!',
        'MyStr0ng@Password',
        'C0mplex#Pass1'
      ];
      
      validPasswords.forEach(password => {
        expect(() => PasswordSchema.parse(password)).not.toThrow();
      });
    });

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        'short', // too short
        'nouppercase123!', // no uppercase
        'NOLOWERCASE123!', // no lowercase
        'NoNumbers!', // no numbers
        'NoSpecialChars123', // no special characters
        'onlyletters', // multiple issues
        ''
      ];
      
      invalidPasswords.forEach(password => {
        expect(() => PasswordSchema.parse(password)).toThrow();
      });
    });

    it('should enforce minimum length of 8 characters', () => {
      expect(() => PasswordSchema.parse('Short1!')).toThrow();
      expect(() => PasswordSchema.parse('Valid123!')).not.toThrow();
    });
  });

  describe('UserRegistrationSchema', () => {
    it('should validate complete registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!'
      };
      
      expect(() => UserRegistrationSchema.parse(validData)).not.toThrow();
    });

    it('should require password confirmation to match', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'DifferentPass123!'
      };
      
      expect(() => UserRegistrationSchema.parse(invalidData)).toThrow();
    });

    it('should validate all fields', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        confirmPassword: 'weak'
      };
      
      expect(() => UserRegistrationSchema.parse(invalidData)).toThrow();
    });
  });

  describe('LoginSchema', () => {
    it('should validate login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'any-password'
      };
      
      expect(() => LoginSchema.parse(validData)).not.toThrow();
    });

    it('should require email and password', () => {
      expect(() => LoginSchema.parse({ email: '', password: 'test' })).toThrow();
      expect(() => LoginSchema.parse({ email: 'test@example.com', password: '' })).toThrow();
    });
  });

  describe('Validation helpers', () => {
    describe('validateEmail', () => {
      it('should return true for valid emails', () => {
        expect(validateEmail('test@example.com')).toBe(true);
      });

      it('should return false for invalid emails', () => {
        expect(validateEmail('invalid-email')).toBe(false);
      });
    });

    describe('validatePassword', () => {
      it('should return true for valid passwords', () => {
        expect(validatePassword('ValidPass123!')).toBe(true);
      });

      it('should return false for invalid passwords', () => {
        expect(validatePassword('weak')).toBe(false);
      });
    });

    describe('extractValidationErrors', () => {
      it('should extract field errors from ZodError', () => {
        try {
          UserRegistrationSchema.parse({
            email: 'invalid',
            password: 'weak',
            confirmPassword: 'different'
          });
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            const errors = extractValidationErrors(error);
            expect(errors).toHaveProperty('email');
            expect(errors).toHaveProperty('password');
            expect(typeof errors.email).toBe('string');
            expect(typeof errors.password).toBe('string');
          }
        }
      });
    });
  });

  describe('Spanish error messages', () => {
    it('should provide Spanish error messages for email validation', () => {
      try {
        EmailSchema.parse('');
      } catch (error: unknown) {
        if (error instanceof Error && 'issues' in error) {
          const zodError = error as { issues: Array<{ message: string }> };
          expect(zodError.issues[0].message).toContain('requerido');
        }
      }
    });

    it('should provide Spanish error messages for password validation', () => {
      try {
        PasswordSchema.parse('weak');
      } catch (error: unknown) {
        if (error instanceof Error && 'issues' in error) {
          const zodError = error as { issues: Array<{ message: string }> };
          const message = zodError.issues[0].message;
          expect(message).toMatch(/contraseña|caracteres|mayúscula|minúscula|número|especial/);
        }
      }
    });

    it('should provide Spanish error message for password confirmation', () => {
      try {
        UserRegistrationSchema.parse({
          email: 'test@example.com',
          password: 'ValidPass123!',
          confirmPassword: 'Different123!'
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          const errors = extractValidationErrors(error);
          expect(errors.confirmPassword).toContain('contraseñas no coinciden');
        }
      }
    });
  });
});