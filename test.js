const testAPI = async () => {
  try {
    const res = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Explain gravity" })
    });
    const data = await res.json();
    console.log("API Response Mindmap:");
    console.dir(data.data.mindmap, { depth: null });
  } catch (err) {
    console.error("Error:", err);
  }
};
testAPI();
