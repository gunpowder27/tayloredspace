import { defineConfig } from "wxt";
export default defineConfig({ modules: ["@wxt-dev/module-react"], manifest: { name: "TayloredSpace", description: "Save products to your TayloredSpace board.", permissions: ["activeTab", "scripting", "storage", "tabs"], host_permissions: ["<all_urls>"] } });
