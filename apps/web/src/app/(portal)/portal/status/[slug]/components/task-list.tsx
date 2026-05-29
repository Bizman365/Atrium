import { TaskRow } from "./task-row";

type Task = React.ComponentProps<typeof TaskRow>["task"];

export function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <section className="py-14">
      <div className="mb-8 max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pexlo-terracotta-deep">Work log</p>
        <h2 className="mt-3 font-serif text-4xl tracking-[-0.04em] text-pexlo-ink">Tasks and deliverables</h2>
      </div>
      <div>
        {tasks.map((task, index) => (
          <TaskRow key={task.id} task={task} index={index} />
        ))}
      </div>
    </section>
  );
}
