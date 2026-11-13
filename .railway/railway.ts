import { defineRailway, github, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const annotationStudioVolume = volume("annotation-studio-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "iad", sizeMB: 5000 });
  const annotationStudio = service("annotation-studio", {
    source: github("rezanmz/annotation-platform", { branch: "main", checkSuites: true, rootDirectory: "/annotation-studio" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile", watchPatterns: ["annotation-studio/**"] },
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { "iad": 1 },
    volumeMounts: { "/data": annotationStudioVolume },
  });

  return project("BASF", {
    variables: { managed: false },
    resources: [annotationStudio, annotationStudioVolume],
  });
});
