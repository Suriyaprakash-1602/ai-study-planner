import { useEffect, useMemo, useState } from "react";
import {
  FaBrain,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaDownload,
  FaMoon,
  FaPlus,
  FaPrint,
  FaRedo,
  FaSun,
  FaTrash,
} from "react-icons/fa";
import { addDays, differenceInCalendarDays, format, isBefore, startOfDay } from "date-fns";

const STORAGE_KEY = "ai-study-planner-data-v1";

function createId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const defaultSubjects = [
  { id: createId(), name: "Python", topics: "Basics, Functions, OOP", difficulty: 3, priority: 4 },
  { id: createId(), name: "SQL", topics: "Queries, Joins, Subqueries", difficulty: 3, priority: 5 },
];

const emptySubject = () => ({
  id: createId(),
  name: "",
  topics: "",
  difficulty: 3,
  priority: 3,
});

function loadSavedData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved || null;
  } catch {
    return null;
  }
}

function splitTopics(subject) {
  const topics = subject.topics
    .split(/,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  return topics.length ? topics : ["Concept review", "Practice questions", "Revision"];
}

function buildStudyUnits(subjects) {
  const units = [];

  subjects.forEach((subject) => {
    splitTopics(subject).forEach((topic, index) => {
      const weight = Number(subject.priority) * 2 + Number(subject.difficulty);
      units.push({
        id: `${subject.id}-${index}`,
        subject: subject.name.trim(),
        topic,
        difficulty: Number(subject.difficulty),
        priority: Number(subject.priority),
        weight,
      });
    });
  });

  return units.sort((a, b) => b.weight - a.weight);
}

function generatePlan({ subjects, examDate, dailyHours, sessionLength, restDay }) {
  const today = startOfDay(new Date());
  const endDate = startOfDay(new Date(`${examDate}T00:00:00`));

  if (isBefore(endDate, today)) {
    throw new Error("Exam date cannot be in the past.");
  }

  const totalDays = differenceInCalendarDays(endDate, today) + 1;
  const studyUnits = buildStudyUnits(subjects);

  if (!studyUnits.length) {
    throw new Error("Add at least one subject and topic.");
  }

  const sessionsPerDay = Math.max(
    1,
    Math.floor((Number(dailyHours) * 60) / Number(sessionLength))
  );

  const plan = [];
  let unitIndex = 0;

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const date = addDays(today, dayIndex);
    const weekday = format(date, "EEEE");

    if (restDay !== "None" && weekday === restDay && dayIndex !== totalDays - 1) {
      plan.push({
        date: date.toISOString(),
        type: "rest",
        completed: false,
        sessions: [],
      });
      continue;
    }

    const isFinalDay = dayIndex === totalDays - 1;
    const isRevisionDay = dayIndex >= Math.max(0, totalDays - 2);

    const sessions = [];

    for (let sessionIndex = 0; sessionIndex < sessionsPerDay; sessionIndex += 1) {
      const unit = studyUnits[unitIndex % studyUnits.length];

      let taskType = "Learn";
      let taskTopic = unit.topic;

      if (isFinalDay) {
        taskType = sessionIndex === sessionsPerDay - 1 ? "Relax & Prepare" : "Final Revision";
        taskTopic =
          sessionIndex === sessionsPerDay - 1
            ? "Review exam materials and sleep early"
            : `${unit.subject}: key formulas, definitions and mistakes`;
      } else if (isRevisionDay || unitIndex >= studyUnits.length) {
        taskType = sessionIndex % 2 === 0 ? "Revision" : "Practice";
        taskTopic =
          sessionIndex % 2 === 0
            ? `${unit.topic} summary and flashcards`
            : `${unit.topic} practice questions`;
      }

      sessions.push({
        id: createId(),
        subject: unit.subject,
        topic: taskTopic,
        taskType,
        minutes: Number(sessionLength),
        difficulty: unit.difficulty,
        completed: false,
      });

      unitIndex += 1;
    }

    plan.push({
      date: date.toISOString(),
      type: "study",
      completed: false,
      sessions,
    });
  }

  return plan;
}

function App() {
  const saved = loadSavedData();

  const [darkMode, setDarkMode] = useState(saved?.darkMode ?? false);
  const [subjects, setSubjects] = useState(saved?.subjects ?? defaultSubjects);
  const [examDate, setExamDate] = useState(
    saved?.examDate ?? format(addDays(new Date(), 14), "yyyy-MM-dd")
  );
  const [dailyHours, setDailyHours] = useState(saved?.dailyHours ?? 2);
  const [sessionLength, setSessionLength] = useState(saved?.sessionLength ?? 45);
  const [restDay, setRestDay] = useState(saved?.restDay ?? "Sunday");
  const [plan, setPlan] = useState(saved?.plan ?? []);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        darkMode,
        subjects,
        examDate,
        dailyHours,
        sessionLength,
        restDay,
        plan,
      })
    );
  }, [darkMode, subjects, examDate, dailyHours, sessionLength, restDay, plan]);

  const stats = useMemo(() => {
    const sessions = plan.flatMap((day) => day.sessions);
    const completed = sessions.filter((session) => session.completed).length;
    const totalMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
    const completedMinutes = sessions
      .filter((session) => session.completed)
      .reduce((sum, session) => sum + session.minutes, 0);

    return {
      totalSessions: sessions.length,
      completedSessions: completed,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      completedHours: Math.round((completedMinutes / 60) * 10) / 10,
      progress: sessions.length ? Math.round((completed / sessions.length) * 100) : 0,
    };
  }, [plan]);

  function updateSubject(id, field, value) {
    setSubjects((current) =>
      current.map((subject) =>
        subject.id === id ? { ...subject, [field]: value } : subject
      )
    );
  }

  function addSubject() {
    setSubjects((current) => [...current, emptySubject()]);
  }

  function removeSubject(id) {
    setSubjects((current) => current.filter((subject) => subject.id !== id));
  }

  function handleGenerate() {
    setError("");

    const validSubjects = subjects.filter(
      (subject) => subject.name.trim() && subject.topics.trim()
    );

    if (!validSubjects.length) {
      setError("Enter at least one subject with topics.");
      return;
    }

    try {
      const generatedPlan = generatePlan({
        subjects: validSubjects,
        examDate,
        dailyHours,
        sessionLength,
        restDay,
      });
      setPlan(generatedPlan);
      setTimeout(() => {
        document.getElementById("generated-plan")?.scrollIntoView({
          behavior: "smooth",
        });
      }, 100);
    } catch (generationError) {
      setError(generationError.message);
    }
  }

  function toggleSession(dayIndex, sessionId) {
    setPlan((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day;

        const sessions = day.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, completed: !session.completed }
            : session
        );

        return {
          ...day,
          sessions,
          completed:
            sessions.length > 0 && sessions.every((session) => session.completed),
        };
      })
    );
  }

  function clearEverything() {
    const confirmed = window.confirm(
      "Delete all subjects, generated plans and progress?"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    setSubjects([emptySubject()]);
    setPlan([]);
    setError("");
  }

  function downloadPlan() {
    const rows = [
      ["Date", "Day", "Subject", "Task Type", "Topic", "Minutes", "Status"],
    ];

    plan.forEach((day) => {
      const date = new Date(day.date);

      if (day.type === "rest") {
        rows.push([
          format(date, "yyyy-MM-dd"),
          format(date, "EEEE"),
          "Rest Day",
          "Rest",
          "Recharge and prepare for the next study day",
          "0",
          "Not applicable",
        ]);
        return;
      }

      day.sessions.forEach((session) => {
        rows.push([
          format(date, "yyyy-MM-dd"),
          format(date, "EEEE"),
          session.subject,
          session.taskType,
          session.topic,
          String(session.minutes),
          session.completed ? "Completed" : "Pending",
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ai-study-plan.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <FaBrain />
          </div>
          <div>
            <h1>AI Study Planner</h1>
            <p>Turn your syllabus into a realistic daily plan.</p>
          </div>
        </div>

        <button
          className="icon-button"
          onClick={() => setDarkMode((current) => !current)}
          aria-label="Toggle theme"
        >
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>
      </header>

      <main className="container">
        <section className="hero card">
          <div>
            <span className="eyebrow">SMART SCHEDULING</span>
            <h2>Plan better. Study consistently. Finish before the exam.</h2>
            <p>
              Add your subjects, topics, available time and exam date. The planner
              prioritizes difficult and important topics automatically.
            </p>
          </div>
          <div className="hero-badge">
            <FaCalendarAlt />
            <span>Personalized daily schedule</span>
          </div>
        </section>

        <section className="planner-layout">
          <div className="card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">STEP 1</span>
                <h3>Add syllabus details</h3>
              </div>
              <button className="secondary-button" onClick={addSubject}>
                <FaPlus /> Add subject
              </button>
            </div>

            <div className="subjects-list">
              {subjects.map((subject, index) => (
                <article className="subject-card" key={subject.id}>
                  <div className="subject-title-row">
                    <strong>Subject {index + 1}</strong>
                    {subjects.length > 1 && (
                      <button
                        className="danger-icon-button"
                        onClick={() => removeSubject(subject.id)}
                        aria-label={`Remove subject ${index + 1}`}
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>

                  <label>
                    Subject name
                    <input
                      value={subject.name}
                      onChange={(event) =>
                        updateSubject(subject.id, "name", event.target.value)
                      }
                      placeholder="Example: Data Structures"
                    />
                  </label>

                  <label>
                    Topics
                    <textarea
                      value={subject.topics}
                      onChange={(event) =>
                        updateSubject(subject.id, "topics", event.target.value)
                      }
                      placeholder="Arrays, Linked Lists, Trees, Graphs"
                      rows="3"
                    />
                    <small>Separate topics using commas or new lines.</small>
                  </label>

                  <div className="two-columns">
                    <label>
                      Difficulty
                      <select
                        value={subject.difficulty}
                        onChange={(event) =>
                          updateSubject(subject.id, "difficulty", event.target.value)
                        }
                      >
                        <option value="1">1 - Very easy</option>
                        <option value="2">2 - Easy</option>
                        <option value="3">3 - Medium</option>
                        <option value="4">4 - Hard</option>
                        <option value="5">5 - Very hard</option>
                      </select>
                    </label>

                    <label>
                      Priority
                      <select
                        value={subject.priority}
                        onChange={(event) =>
                          updateSubject(subject.id, "priority", event.target.value)
                        }
                      >
                        <option value="1">1 - Low</option>
                        <option value="2">2</option>
                        <option value="3">3 - Medium</option>
                        <option value="4">4</option>
                        <option value="5">5 - Critical</option>
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="card settings-card">
            <span className="eyebrow">STEP 2</span>
            <h3>Set your availability</h3>

            <label>
              Exam date
              <input
                type="date"
                min={format(new Date(), "yyyy-MM-dd")}
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
              />
            </label>

            <label>
              Study hours per day
              <input
                type="number"
                min="0.5"
                max="12"
                step="0.5"
                value={dailyHours}
                onChange={(event) => setDailyHours(event.target.value)}
              />
            </label>

            <label>
              Session length
              <select
                value={sessionLength}
                onChange={(event) => setSessionLength(event.target.value)}
              >
                <option value="25">25 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </label>

            <label>
              Weekly rest day
              <select
                value={restDay}
                onChange={(event) => setRestDay(event.target.value)}
              >
                <option>None</option>
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
                <option>Thursday</option>
                <option>Friday</option>
                <option>Saturday</option>
                <option>Sunday</option>
              </select>
            </label>

            {error && <div className="error-message">{error}</div>}

            <button className="primary-button full-width" onClick={handleGenerate}>
              <FaBrain /> Generate smart plan
            </button>

            <button className="ghost-button full-width" onClick={clearEverything}>
              <FaRedo /> Reset planner
            </button>

            <div className="tip-box">
              <FaClock />
              <p>
                The generator gives more attention to subjects with higher
                priority and difficulty.
              </p>
            </div>
          </aside>
        </section>

        {plan.length > 0 && (
          <section id="generated-plan" className="plan-section">
            <div className="section-heading plan-header">
              <div>
                <span className="eyebrow">YOUR PLAN</span>
                <h2>Personalized study schedule</h2>
              </div>

              <div className="action-group">
                <button className="secondary-button" onClick={downloadPlan}>
                  <FaDownload /> Download CSV
                </button>
                <button className="secondary-button" onClick={() => window.print()}>
                  <FaPrint /> Print
                </button>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Progress</span>
                <strong>{stats.progress}%</strong>
              </div>
              <div className="stat-card">
                <span>Completed sessions</span>
                <strong>
                  {stats.completedSessions}/{stats.totalSessions}
                </strong>
              </div>
              <div className="stat-card">
                <span>Total study hours</span>
                <strong>{stats.totalHours}</strong>
              </div>
              <div className="stat-card">
                <span>Hours completed</span>
                <strong>{stats.completedHours}</strong>
              </div>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${stats.progress}%` }}
              />
            </div>

            <div className="days-grid">
              {plan.map((day, dayIndex) => {
                const date = new Date(day.date);

                return (
                  <article
                    className={`day-card ${day.completed ? "day-complete" : ""}`}
                    key={day.date}
                  >
                    <div className="day-header">
                      <div>
                        <span>{format(date, "EEEE")}</span>
                        <h3>{format(date, "dd MMM yyyy")}</h3>
                      </div>
                      {day.completed && <FaCheckCircle className="complete-icon" />}
                    </div>

                    {day.type === "rest" ? (
                      <div className="rest-day">
                        <span>🌿</span>
                        <strong>Rest and recharge</strong>
                        <p>Light reading or flashcards only if you feel comfortable.</p>
                      </div>
                    ) : (
                      <div className="session-list">
                        {day.sessions.map((session) => (
                          <label
                            className={`session-item ${
                              session.completed ? "session-complete" : ""
                            }`}
                            key={session.id}
                          >
                            <input
                              type="checkbox"
                              checked={session.completed}
                              onChange={() => toggleSession(dayIndex, session.id)}
                            />
                            <div className="session-content">
                              <div className="session-topline">
                                <strong>{session.subject}</strong>
                                <span>{session.minutes} min</span>
                              </div>
                              <p>{session.topic}</p>
                              <small>{session.taskType}</small>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer>
        Built for focused students • Data is stored only in your browser
      </footer>
    </div>
  );
}

export default App;
