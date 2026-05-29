import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { PageHeader } from "./components/page-header";
import { PortalFooter } from "./components/portal-footer";
import { ProjectTitle } from "./components/project-title";
import { CommentsList } from "./components/comments-list";
import { ProjectUpdatesFeed } from "./components/project-updates-feed";
import { StatBand } from "./components/stat-band";
import { TaskList } from "./components/task-list";
import { getProjectStats, loadStatusPageProject } from "./queries";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-pexlo-serif",
  display: "swap",
});

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Project status · ${slug}`,
    robots: { index: false, follow: false },
  };
}

export default async function StatusPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await loadStatusPageProject(slug);
  const stats = getProjectStats(project);

  return (
    <div className={`${sourceSerif.variable} min-h-screen bg-pexlo-paper text-pexlo-ink`}>
      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-10 sm:py-12 lg:px-12">
        <PageHeader orgName={project.organization.name} />
        <ProjectTitle
          name={project.name}
          description={project.description}
          status={project.status}
          createdAt={project.createdAt}
          completedAt={project.completedAt}
        />
        <CommentsList comments={project.comments} />
        <StatBand
          tasksTotal={stats.tasksTotal}
          completionPercent={stats.completionPercent}
          deliverablesCount={stats.deliverablesCount}
        />
        <ProjectUpdatesFeed updates={project.updates} />
        <TaskList tasks={project.tasks} />
        <PortalFooter generatedAt={new Date()} />
      </main>
    </div>
  );
}
