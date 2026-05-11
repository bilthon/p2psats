import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
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
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
