#!/usr/bin/env bun
import { execFileSync } from "child_process";
import { PrismaClient } from "../packages/database/src";

const prisma = new PrismaClient();
const API_BASE_URL = process.env.AGENT_API_BASE_URL ?? "http://127.0.0.1:3000";
const API_KEY = process.env.AGENT_API_KEY ?? execFileSync("security", [
  "find-generic-password",
  "-s",
  "pexlo-portal-api-crank",
  "-a",
  "chris@dwelbase.io",
  "-w",
], { encoding: "utf8" }).trim();

const projectUpdatesBySlug: Record<string, Array<{ title: string; body: string; externalId: string }>> = {
  "csp-it-onboarding-may-2026": [
    {
      title: "Kickoff: tenant health and Microsoft Graph audit captured",
      body: "Baseline discovery is complete: Microsoft Graph tenant health, Entra/Intune posture, device inventory, and remediation priorities were captured for CSP IT onboarding.",
      externalId: "csp-update-csp-it-onboarding-kickoff",
    },
    {
      title: "Phase 1 complete: onboarding tasks delivered",
      body: "All eight onboarding work items are complete. The tenant is secure, Autopilot enrollment is working, CSP device grouping is fixed, BitLocker is active, and the Nitro deployment package is ready for Intune rollout.",
      externalId: "csp-update-csp-it-onboarding-phase-1-complete",
    },
  ],
  "csp-internal-ops-phase-0-discovery": [
    {
      title: "Phase 0 discovery complete",
      body: "Initial CSP internal operations discovery is complete. The portal foundation is live, Phase 2 onboarding is queued, and accounting-platform requirements have been captured for the next operations workflow decisions.",
      externalId: "csp-update-internal-ops-phase-0-complete",
    },
  ],
  "pexlo-rd-tax-credit-briefing-csp-001": [
    {
      title: "Initial R&D briefing complete",
      body: "Federal R&D Tax Credit Briefing No. 001 has been delivered. The custom Pexlo Briefing template is established for future CSP/Pexlo R&D substantiation packages.",
      externalId: "csp-update-rd-briefing-001-complete",
    },
  ],
};

const commentBodiesByTitle: Record<string, string> = {
  "Full Microsoft Graph tenant audit + baseline health score": "Captured CSP's Microsoft Graph tenant baseline, including users, admin posture, devices, licenses, groups, and security signals to establish the remediation starting point.",
  "Entra/Intune cleanup strategy + field execution kit": "Converted discovery into client-facing and technician-facing remediation materials so CSP has a clear execution path for Entra and Intune cleanup.",
  "HP 8CG1108HR6 Autopilot infrastructure and enrollment repair": "Repaired Autopilot enrollment for the HP Pavilion x360, including registration workflow cleanup and Intune enrollment validation.",
  "CSP device naming convention decision": "Locked CSP's device naming convention and rename plan so Autopilot, Intune, and future reporting stay consistent across device types.",
  "SyncroMSP RMM installer link captured for CSP evaluation": "Captured the SyncroMSP RMM installer path for evaluation while keeping deployment deferred until the CSP tooling decision is finalized.",
  "Lenovo PF4TJXBM Autopilot enrollment + dynamic group fix": "Diagnosed the Lenovo Autopilot grouping issue and updated the CSP dynamic group rule so CSP-tagged devices land in the correct Intune policy target.",
  "Lenovo PF4TJXBM policy and BitLocker verification": "Verified the Lenovo device reached the CSP Autopilot Devices group, received required policies, and started BitLocker encryption successfully.",
  "Nitro PDF Pro 14 Intune Win32 deployment package build": "Built and archived the Nitro PDF Pro 14 Intune Win32 deployment package, including install/uninstall commands and detection details for rollout.",
  "Pexlo Portal production launch with CSP onboarding queued for Phase 2": "Launched the portal production foundation and queued CSP onboarding work for the next client-facing phase.",
  "CitySafe accounting platform comparison reviewed": "Reviewed the CitySafe accounting platform comparison and captured purchase-order requirements to support the operations platform decision.",
  "CitySafe §174A / §41 R&D credit one-pager": "Prepared the CitySafe R&D credit one-pager covering federal treatment and CPA-facing substantiation points for software development work.",
  "Federal, NYS, and NYC R&D credit research memo": "Completed the federal, New York State, and New York City R&D credit research memo, including §41, §174A, payroll offset, and state/local treatment.",
  "Pexlo R&D briefing template and PDF design iterations": "Produced the Pexlo-branded R&D briefing template and iterated the HTML/PDF design into a reusable client-ready briefing format.",
};

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "x-request-id": `csp-backfill-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`${path} failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return { status: res.status, json };
}

async function main() {
  const projects = await prisma.project.findMany({
    where: { source: "agent", slug: { in: Object.keys(projectUpdatesBySlug) } },
    include: { tasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
    orderBy: { createdAt: "asc" },
  });

  let commentsCreated = 0;
  let commentsExisting = 0;
  let updatesCreated = 0;
  let updatesExisting = 0;

  for (const project of projects) {
    for (const task of project.tasks) {
      const body = commentBodiesByTitle[task.title] ?? `${task.title}: ${task.description?.replace(/^Original date[s]?: [^.]+\.\s*/, "").split(". ")[0] ?? "Work completed."}`;
      const result = await post("/api/agent/comments", {
        taskId: task.id,
        body,
        externalId: `csp-comment-${task.id}`,
        clientVisible: true,
      });
      result.status === 201 ? commentsCreated++ : commentsExisting++;
    }

    for (const update of projectUpdatesBySlug[project.slug ?? ""] ?? []) {
      const result = await post("/api/agent/project-updates", {
        projectId: project.id,
        title: update.title,
        body: update.body,
        externalId: update.externalId,
        clientVisible: true,
      });
      result.status === 201 ? updatesCreated++ : updatesExisting++;
    }
  }

  console.log(JSON.stringify({
    projects: projects.length,
    commentsCreated,
    commentsExisting,
    updatesCreated,
    updatesExisting,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
