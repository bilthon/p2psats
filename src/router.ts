import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("./views/HomeView.vue"),
  },
  // Permanent redirect from the legacy /book path so older bookmarks still
  // land on the home page.
  { path: "/book", redirect: "/" },
  {
    path: "/alerts",
    name: "alerts",
    component: () => import("./views/AlertsView.vue"),
  },
  {
    path: "/about",
    name: "about",
    component: () => import("./views/AboutView.vue"),
  },
  {
    path: "/contact",
    name: "contact",
    component: () => import("./views/ContactView.vue"),
  },
  {
    path: "/privacy",
    name: "privacy",
    component: () => import("./views/PrivacyView.vue"),
  },
  {
    path: "/terms",
    name: "terms",
    component: () => import("./views/TermsView.vue"),
  },
  // Auth routes — added in task #12 (API client + auth UI)
  {
    path: "/signin",
    name: "sign-in",
    component: () => import("./views/SignInView.vue"),
  },
  {
    path: "/auth/verify",
    name: "auth-verify",
    component: () => import("./views/AuthVerifyView.vue"),
  },
];
