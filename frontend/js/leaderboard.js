export async function loadLeaderboard() {
  const res = await fetch("http://localhost:5000/api/leaderboard");
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
}
