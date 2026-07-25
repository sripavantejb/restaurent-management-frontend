# HRMS

Branch HR for managers (`users.manage`):

- **Overview** — headcount, today present/late/leave/absent, pending leaves, month leave days, payroll total
- **Attendance** — day roster (check-in/out/leave/absent) + month matrix (P/L/V/A) with staff filter
- **Leaves** — request (CL/SL/EL/UNPAID/COMP_OFF), approve/reject/cancel, annual balances, month filter + individual staff
- **Payroll** — rebuild from attendance, list, CSV export
- **Staff** — directory with deep links to individual leaves / month attendance

APIs: `/api/hr/overview`, `/api/hr/attendance`, `/api/hr/leaves`, `/api/hr/leaves/[id]`, `/api/hr/payroll`

Models: `Attendance`, `LeaveRequest`, `PayrollEntry`
