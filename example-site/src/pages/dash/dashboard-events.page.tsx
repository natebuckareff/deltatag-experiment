import { EventsTable } from '../../components/events-table.island';

export default function DashboardEvents() {
  return (
    <div>
      <div>dashboard events</div>
      <EventsTable client:load client:id="events-table" />
    </div>
  );
}
