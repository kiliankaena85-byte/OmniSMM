## 2026-07-07T15:42:51Z
You are a teamwork_preview_worker.
Your working directory is d:\SMM_plan_2\.agents\worker_init_project.
Your task is to initialize the project files inside the target directory: d:\SMM_plan_2\teamwork_projects\round_table_experts.

Steps to perform:
1. Create the directory d:\SMM_plan_2\teamwork_projects\round_table_experts if it does not exist.
2. Initialize a package.json file. It should include the following dependencies/devDependencies:
   - "zod": "^3.x"
   - "typescript": "^5.x"
   - "@types/node": "^20.x"
   - and any other standard TypeScript execution or build tools if needed (e.g., tsx, vitest).
3. Initialize a tsconfig.json file configured for modern Node.js development:
   - target: "es2022" or similar
   - module: "commonjs" or "NodeNext"
   - strict: true
   - esModuleInterop: true
   - outDir: "./dist"
   - include: ["src/**/*"]
4. Run `npm install` inside d:\SMM_plan_2\teamwork_projects\round_table_experts to install dependencies and verify the build.
5. Create a `handoff.md` in your working directory (d:\SMM_plan_2\.agents\worker_init_project) summarizing your changes, commands run, and verifying that the initialization completed successfully.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
