import * as L from '../../components/login-form';
import UsersTable from '../../components/users-table.island';
import { Island } from '../../lib/island';

export default function DashboardUsers() {
  return (
    <div>
      <div>dashboard users</div>
      <Island id="user-id">
        <UsersTable />
      </Island>
      <Island>
        <UsersTable />
      </Island>
      <Island>
        <L.LoginForm />
      </Island>
    </div>
  );
}
