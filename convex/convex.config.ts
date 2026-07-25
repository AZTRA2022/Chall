import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";

const app = defineApp();

// Composant R2. Il reste inerte tant que les variables R2_* ne sont pas
// définies : le code de stockage bascule sur Convex dans ce cas.
app.use(r2);

export default app;
