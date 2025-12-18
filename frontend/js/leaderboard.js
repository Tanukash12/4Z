export async function loadLeaderboard() {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/leaderboard");
    if (!res.ok) return;

    const data = await res.json();
    const table = document.getElementById("leaderboard");
    table.innerHTML = "";

    data.data.forEach((player, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${player.username}</td>
        <td>${player.wins}</td>
      `;
      table.appendChild(row);
    });
  } catch (err) {
    console.warn("Leaderboard offline");
  }
}
