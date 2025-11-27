import * as L from '../../components/login-form';
import UsersTable from '../../components/users-table.island';

export default function DashboardUsers() {
  return (
    <div>
      <div>dashboard users</div>
      <UsersTable client:load client:id="user-id" />
      <UsersTable client:load />
      <L.LoginForm client:load />
    </div>
  );
}
