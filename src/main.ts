import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { i18n, getLocaleRef } from "./i18n";
import "./assets/styles.css";

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);
document.documentElement.setAttribute("lang", getLocaleRef().value);
app.mount("#app");
