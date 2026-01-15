function createInputRow(fields, removeLabel = "Remove") {
  const wrapper = document.createElement("div");
  wrapper.className = "list-item";
  const grid = document.createElement("div");
  grid.className = "grid grid-2";
  fields.forEach((field) => {
    const block = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = field.label;
    const input = field.multiline ? document.createElement("textarea") : document.createElement("input");
    if (!field.multiline) {
      input.type = field.type || "text";
    }
    input.dataset.field = field.key;
    input.placeholder = field.placeholder || "";
    if (field.value) input.value = field.value;
    block.append(label, input);
    if (field.multiline) {
      block.style.gridColumn = "1 / -1";
    }
    grid.appendChild(block);
  });
  wrapper.appendChild(grid);

  if (fields.find((f) => f.multiline)) {
    grid.querySelectorAll("textarea").forEach((area) => {
      area.rows = 3;
    });
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "ghost remove";
  remove.textContent = removeLabel;
  remove.addEventListener("click", () => wrapper.remove());
  wrapper.appendChild(remove);
  return wrapper;
}

export function setupProfileForm() {
  const form = document.getElementById("profileForm");
  const statusEl = document.getElementById("status");

  const lists = {
    links: document.getElementById("linksList"),
    education: document.getElementById("educationList"),
    experience: document.getElementById("experienceList"),
    skills: document.getElementById("skillsList"),
    projects: document.getElementById("projectsList")
  };

  function addLink(data = {}) {
    const row = createInputRow([
      { key: "label", label: "Label", value: data.label || "" },
      { key: "url", label: "URL", value: data.url || "" }
    ]);
    lists.links.appendChild(row);
  }

  function addEducation(data = {}) {
    const row = createInputRow([
      { key: "degree", label: "Degree", value: data.degree || "" },
      { key: "major", label: "Major", value: data.major || "" },
      { key: "institution", label: "Institution", value: data.institution || "" },
      { key: "location", label: "Country", value: data.location || data.country || "" },
      { key: "startDate", label: "Start date", value: data.startDate || data.start_date || "" },
      { key: "endDate", label: "End date", value: data.endDate || data.end_date || "" }
    ]);
    lists.education.appendChild(row);
  }

  function addExperience(data = {}) {
    const row = createInputRow([
      { key: "title", label: "Job title", value: data.title || "" },
      { key: "company", label: "Company", value: data.company || "" },
      { key: "location", label: "Location", value: data.location || "" },
      { key: "startDate", label: "Start date", value: data.startDate || data.start_date || "" },
      { key: "endDate", label: "End date", value: data.endDate || data.end_date || "" },
      {
        key: "bullets",
        label: "Key responsibilities (one per line)",
        value: Array.isArray(data.bullets) ? data.bullets.join("\n") : "",
        multiline: true
      }
    ]);
    lists.experience.appendChild(row);
  }

  function addSkill(data = {}) {
    const row = createInputRow([
      { key: "category", label: "Category", value: data.category || "" },
      {
        key: "items",
        label: "Skills (comma or line separated)",
        value: Array.isArray(data.items) ? data.items.join(", ") : "",
        multiline: true
      }
    ]);
    lists.skills.appendChild(row);
  }

  function addProject(data = {}) {
    const row = createInputRow([
      { key: "name", label: "Project name", value: data.name || "" },
      {
        key: "technologies",
        label: "Technologies (comma separated)",
        value: Array.isArray(data.technologies) ? data.technologies.join(", ") : ""
      },
      { key: "link", label: "Link", value: data.link || "" },
      {
        key: "bullets",
        label: "Impact bullets (one per line)",
        value: Array.isArray(data.bullets) ? data.bullets.join("\n") : "",
        multiline: true
      }
    ]);
    lists.projects.appendChild(row);
  }

  form.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    const action = actionTarget?.dataset.action;
    if (!action) return;

    if (action === "add-link") addLink();
    if (action === "add-education") addEducation();
    if (action === "add-experience") addExperience();
    if (action === "add-skill") addSkill();
    if (action === "add-project") addProject();
  });

  function readList(listEl) {
    return Array.from(listEl.querySelectorAll(".list-item"));
  }

  function readFields(row) {
    const data = {};
    row.querySelectorAll("[data-field]").forEach((input) => {
      data[input.dataset.field] = input.value.trim();
    });
    return data;
  }

  function collectProfile() {
    const profile = {
      personal: {
        fullName: document.getElementById("fullName").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        location: document.getElementById("location").value.trim(),
        links: readList(lists.links).map(readFields).filter((item) => item.label || item.url)
      },
      summary: document.getElementById("summary").value.trim(),
      education: readList(lists.education)
        .map(readFields)
        .filter((item) => item.institution || item.degree || item.major),
      experience: readList(lists.experience)
        .map((row) => {
          const data = readFields(row);
          return {
            title: data.title,
            company: data.company,
            location: data.location,
            startDate: data.startDate,
            endDate: data.endDate,
            bullets: data.bullets ? data.bullets.split(/\n+/).map((b) => b.trim()).filter(Boolean) : []
          };
        })
        .filter((item) => item.title || item.company),
      skills: readList(lists.skills)
        .map((row) => {
          const data = readFields(row);
          return {
            category: data.category,
            items: data.items
              ? data.items.split(/,|\n/).map((item) => item.trim()).filter(Boolean)
              : []
          };
        })
        .filter((item) => item.category || item.items.length),
      projects: readList(lists.projects)
        .map((row) => {
          const data = readFields(row);
          return {
            name: data.name,
            technologies: data.technologies
              ? data.technologies.split(/,|\n/).map((item) => item.trim()).filter(Boolean)
              : [],
            link: data.link,
            bullets: data.bullets ? data.bullets.split(/\n+/).map((b) => b.trim()).filter(Boolean) : []
          };
        })
        .filter((item) => item.name || item.technologies.length || item.link || item.bullets.length)
    };

    return profile;
  }

  function loadProfile(profile) {
    document.getElementById("fullName").value = profile.personal?.fullName || "";
    document.getElementById("email").value = profile.personal?.email || "";
    document.getElementById("phone").value = profile.personal?.phone || "";
    document.getElementById("location").value = profile.personal?.location || "";
    document.getElementById("summary").value = profile.summary || "";

    lists.links.innerHTML = "";
    (profile.personal?.links || []).forEach(addLink);

    lists.education.innerHTML = "";
    (profile.education || []).forEach(addEducation);

    lists.experience.innerHTML = "";
    (profile.experience || []).forEach(addExperience);

    lists.skills.innerHTML = "";
    (profile.skills || []).forEach(addSkill);

    lists.projects.innerHTML = "";
    (profile.projects || []).forEach(addProject);
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  return {
    form,
    loadProfile,
    collectProfile,
    setStatus
  };
}
