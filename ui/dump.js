(() => {
  const el = document.getElementById("dump");
  fetch("/api/state")
    .then((res) => res.json())
    .then((state) => {
      el.textContent = JSON.stringify(state.attention, null, 2);
    })
    .catch((err) => {
      el.textContent = String(err);
    });
})();
