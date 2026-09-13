(function () {
  var THEME_KEY = "theme";
  try {
    if (localStorage.getItem(THEME_KEY) === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (error) {}

  window.setTheme = function (isDark) {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (error) {}
  };
})();
