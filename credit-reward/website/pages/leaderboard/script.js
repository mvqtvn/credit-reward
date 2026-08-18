// Example data — replace with backend fetch
const students = [
  { name: "Natalie", points: 100 },
  { name: "Bhavna", points: 95 },
  { name: "Ferne", points: 80 },
  { name: "Eric", points: 70 },
  { name: "Maggie", points: 65 }
];

// Sort by points descending
students.sort((a, b) => b.points - a.points);

const tbody = document.querySelector("#leaderboardTable tbody");

// Populate table
students.forEach((student, index) => {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${index + 1}</td>
    <td>${student.name}</td>
    <td>${student.points}</td>
  `;
  tbody.appendChild(row);
});
