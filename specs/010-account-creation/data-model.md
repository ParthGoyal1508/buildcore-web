# Data Model: Account Creation Frontend (Invite Flow)

## Create User form

```typescript
interface CreateUserFormValues {
  email: string;
  roleId: string;
  companyId?: string;        // omitted entirely from submit when role resolves to Super Admin
  linkMode: 'employee' | 'displayName';
  employeeId?: string;       // required when linkMode === 'employee'
  displayName?: string;      // required when linkMode === 'displayName'
}

const createUserSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
  companyId: z.string().optional(),
  linkMode: z.enum(['employee', 'displayName']),
  employeeId: z.string().optional(),
  displayName: z.string().optional(),
}).refine(v => v.linkMode === 'employee' ? !!v.employeeId : !!v.displayName, {
  message: 'Select an employee or enter a display name',
});
```

## Set Password page state

```typescript
type InviteValidation =
  | { status: 'loading' }
  | { status: 'valid'; email: string }
  | { status: 'invalid'; reason: 'expired' | 'consumed' | 'not_found' };

const setPasswordSchema = z.object({
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'At least 1 uppercase letter')
    .regex(/[0-9]/, 'At least 1 number'),
});
```

## API response shapes (from `buildcore-api` contract)

```typescript
interface CreateUserResponse { id: string; email: string; status: 'pending'; emailDispatchFailed: boolean; }
interface UnlinkedEmployee { id: string; firstName: string; lastName: string; }
interface InviteValidationResponse { valid: boolean; email?: string; reason?: 'expired' | 'consumed' | 'not_found'; }
```
