import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/book" },
  {
    path: "/book",
    name: "book",
    component: () => import("./views/BookView.vue"),
  },
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
