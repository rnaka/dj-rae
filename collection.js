import Scraper from "./scraper.js";

const ul = document.getElementById("ringsList");
const dropdown = document.getElementById("sort-by");
const search = document.getElementById("search");
const total = document.getElementById("total");
const emailButton = document.getElementById("emailButton");
const snackbar = document.getElementById("snackbar");
const editModal = document.getElementById("edit-modal");
const emailModal = document.getElementById("email-modal");
const name = document.querySelector("#name p");
const editListName = document.getElementById("editName");
const listNameModal = document.getElementById("list-name-modal");

let searchValue = "";
let sortProperty = dropdown.options[dropdown.selectedIndex].value;

let allData;
let isEmptyList;

chrome.storage.local.get(["rings", "newUrl"], result => {
  console.log("collection.js -> newUrl: ", result.newUrl);
  console.log("collection.js -> current rings: ", result.rings);
  if (result.rings && result.rings.length) {
    // rings data array exists
    if (result.rings.map(ring => ring.url).includes(result.newUrl)) {
      // newUrl already added
      console.log("newUrl already added");
      alreadyAddedSnackbar();
      getRingsAndSetup();
    } else if (!!result.newUrl) {
      // newUrl new
      console.log("newUrl new");
      getRingsAndSetup().then(addLoadingCard);
      addNewUrl(result.newUrl);
    } else {
      // newUrl is null
      getRingsAndSetup();
    }
  } else if (!!result.newUrl) {
    // rings data array empty, newUrl new
    console.log("rings data array empty");
    isEmptyList = true;
    addLoadingCard();
    addNewUrl(result.newUrl);
  } else {
    // empty array, no newUrl
    emptyList();
  }
  chrome.storage.local.set({ newUrl: null });
});

const getRingsAndSetup = () => {
  ul.innerHTML = "";

  return new Promise((res, rej) => {
    chrome.storage.local.get("rings", async result => {
      allData = await result.rings;
      setup();
      res(allData);
    });
  });
};

/**
 * Main setup function. Called after every filter / sorting.
 * Appends HTML item cards to ul element.
 */

const setup = () => {
  ul.innerHTML = "";
  console.log(allData);

  if (allData && allData.length === 0) {
    emptyList();
  } else if (allData.length > 0) {
    document.querySelector("div.items-container").classList.remove("invisible");
    document
      .querySelector("div#nav__search-container")
      .classList.remove("invisible");
    document.querySelector("div.sort-bar").classList.remove("invisible");
  }

  const x = allData.filter(data =>
    data.title.toLowerCase().includes(searchValue)
  );

  total.innerText = x.length
    ? x.length > 1
      ? x.length + " items"
      : "1 item"
    : null;

  displayListName();

  setupEmailCheckboxes();

  [...allData]
    /* ^ this doesn't destructively manipulate the original list,
  and the products can later be sorted by date */
    .sort(dynamicSort(sortProperty))
    .filter(data => data.title.toLowerCase().includes(searchValue))
    .forEach(data => {
      ul.appendChild(turnDataIntoHtml(data));
    });
};

const addNewUrl = url => {
  chrome.storage.local.get("newDoc", nd => {
    const newDoc = nd.newDoc;

    new Scraper(url, newDoc).scrape().then(res => {
      console.log("RES ", res);
      // no title cutoff
      if (res && !!res.title) {
        // fetch successful
        chrome.storage.local.set(
          {
            rings: [
              // ...allData,
              ...(allData || []),
              {
                ...res,
                description: capDescriptionLength(res.description, 400),
                notes: ""
              }
            ]
          },
          () => {
            removeLoadingCard();
            getRingsAndSetup();
          }
        );
      } else {
        // no title => fetch failed
        fetchFailedSnackbar();
        removeLoadingCard();
        isEmptyList && emptyList();
      }
    });
    chrome.storage.local.set({ newDoc: null });
  });
};

/**
 * Takes JS Object of data and creates HTML markup
 */
const turnDataIntoHtml = data => {
  const div = `
    <div class="edit clear">
      <img src="img/edit-icon.png" alt="edit" class="edit-icon"><span>Edit</span>
    </div>
    <div class="card-remove">×</div>
    <div class="card-img">
    ${
      data.image === undefined || data.image === ""
        ? `<p class="unavailable">Image unavailable. Visit product link for more details.</p>`
        : `<img src="${data.image}" alt="${data.title}">`
    }

    </div>
    <div class="card-title">
      <h3>${data.title}</h3>
    </div>
    <div class="card-desc">
      <p>${!!data.description ? data.description : ""}</p>
    </div>
    <div class="notes">
    ${
      data.notes.trim() === ""
        ? ""
        : `<h4>Notes: </h4><p>${data.notes.replace(/\n/g, "<br />")}</p>`
    }
    </div>
    <div class="card-cost">
    ${
      data.price === undefined
        ? `<p><span class="unavailable">Price unavailable. Visit product link for more details.</span></p>`
        : `<p><span>Price:</span>  &nbsp; ${parseFloat(
            data.price
          ).toLocaleString("en-US", {
            style: "currency",
            currency: "USD"
          })}</p>`
    }
    </div>
    <a href="${data.url}" rel="noreferrer" target="_blank" class="view">
    <div class="clear">View Product</div>
    </a>
    <a class="overlay-link" href="${
      data.url
    }" rel="noreferrer" target="_blank" class="view">
    <span class="invisible">${data.title}</span>
    </a>
    `;

  const li = document.createElement("li");
  li.className = "card";
  li.dataset.id = allData.findIndex(x => x.url === data.url);

  li.innerHTML = div;

  return li;
};

const removeItemFromList = removeUrl => {
  const newArray = [...allData].filter(ring => ring.url !== removeUrl);
  chrome.storage.local.set({ rings: newArray }, () => {
    allData = newArray;
    setup();
  });
};

window.onclick = e => {
  // edit button clicked
  (e.target.classList.contains("edit") ||
    e.target.parentElement.classList.contains("edit")) &&
    editData(allData[e.target.closest("li").dataset.id]);

  // remove button clicked
  e.target.classList.contains("card-remove") &&
    confirm(
      `Are you sure you want to remove ${allData[e.target.closest("li").dataset.id].title}?`
    ) &&
    removeItemFromList(allData[e.target.closest("li").dataset.id].url);

  if (e.target === emailModal) {
    // remove form data
    emailModal.style.display = "none";
  }

  if (e.target === editModal) {
    editModal.style.display = "none";
  }

  if (e.target === listNameModal) {
    listNameModal.style.display = "none";
  }
};

window.onkeydown = e => {
  if (event.key === "Escape") {
    // remove form data
    emailModal.style.display = "none";
    editModal.style.display = "none";
    listNameModal.style.display = "none";
  }
};

/**
 * Appends edit form and fills it with editable data that can be saved or reset
 */
const editData = data => {
  const form = document.getElementById("edit-form");

  document.getElementById("url-edit").value = data.url;
  document.getElementById("edit-display-image").src = data.image;
  form.elements["title"].value = data.title;
  form.elements["image"].value = data.image;
  form.elements["description"].value = data.description;
  form.elements["price"].value = data.price || "";
  form.elements["notes"].value = data.notes;

  editModal.style.display = "block";

  document.getElementById("closeEditModal").onclick = () => {
    editModal.style.display = "none";
  };

  const reset = document.getElementById("resetFields");
  reset.onclick = e => {
    e.preventDefault(); // otherwise form submits

    const spinner = document.getElementById("spinner");
    reset.classList.add("invisible");
    spinner.classList.remove("invisible");

    new Scraper(data.url).scrape().then(res => {
      reset.classList.remove("invisible");
      spinner.classList.add("invisible");

      form.elements["title"].value =
        res.title.length > 0 ? res.title : data.title;
      form.elements["image"].value =
        res.image.length > 0 ? res.image : data.image;
      form.elements["description"].value =
        res.description.length > 0
          ? capDescriptionLength(res.description, 400)
          : data.description;
      form.elements["price"].value = !!res.price ? res.price || "" : data.price;
    });
  };

  const submitHandler = e => {
    e.preventDefault();

    const newTitle = document.getElementById("title-edit").value;
    const newImage = document.getElementById("image-edit").value;
    const newDescription = document.getElementById("description-edit").value;
    const newPrice = parseFloat(document.getElementById("price-edit").value);
    const newNotes = document.getElementById("notes-edit").value;

    // brilliant!
    const newArray = [...allData].map(ring => {
      return ring.url === data.url
        ? {
            ...ring,
            title: newTitle,
            image: newImage,
            description: newDescription,
            price: newPrice,
            notes: newNotes
          }
        : ring;
    });
    chrome.storage.local.set({ rings: newArray }, () => {
      getRingsAndSetup();
      editModal.style.display = "none";
    });
  };

  form.onsubmit = e => submitHandler(e);
};

/**
 * Pretty much a sort function for when the sort buttons are clicked
 */
const dynamicSort = sortProperty => {
  if (sortProperty === "price-low") {
    return function(a, b) {
      if (!!a.price && !!b.price) {
        const result =
          parseFloat(a["price"]) < parseFloat(b["price"])
            ? -1
            : parseFloat(a["price"]) > parseFloat(b["price"])
            ? 1
            : 0;
        return result;
      } else if (!!a.price) {
        return -1;
      } else if (!!b.price) {
        return 1;
      }
    };
  } else if (sortProperty === "price-high") {
    return function(a, b) {
      if (!!a.price && !!b.price) {
        const result =
          parseFloat(a["price"]) < parseFloat(b["price"])
            ? 1
            : parseFloat(a["price"]) > parseFloat(b["price"])
            ? -1
            : 0;
        return result;
      } else if (!!a.price) {
        return -1;
      } else if (!!b.price) {
        return 1;
      }
    };
  } else if (sortProperty === "date-last") {
    return function(a, b) {
      return -1; // reverses array
    };
  } else if (sortProperty === "date-first") {
    return function(a, b) {
      return 1;
    };
  } else {
    return function(a, b) {
      const result =
        a[sortProperty] < b[sortProperty]
          ? -1
          : a[sortProperty] > b[sortProperty]
          ? 1
          : 0;
      return result;
    };
  }
};

/**
 * Add event listener to dropdown inputs, reloading data when clicked
 */

dropdown.onchange = e => {
  sortProperty = e.target.value;
  ul.innerHTML = "";
  setup();
};

/**
 * Add event listener to search input, filtering and reloading data when changed
 */
search.oninput = e => {
  searchValue = e.target.value;
  ul.innerHTML = "";
  setup();
};

editListName.onclick = e => {
  const listNameForm = document.getElementById("list-name-form");
  const cancelListName = document.getElementById("closeListNameModal");
  listNameModal.style.display = "block";
  document.getElementById("list-name-edit").focus();

  cancelListName.onclick = e => {
    listNameModal.style.display = "none";
    listNameForm.reset();
  };

  listNameForm.onsubmit = e => {
    e.preventDefault();

    if (
      e.target["list-name"].value.trim().length < 4 ||
      e.target["list-name"].value.trim().length > 30
    ) {
      alert("List name must be between 4 and 30 characters.");
      listNameForm.reset();
      document.getElementById("list-name-edit").focus();
    } else {
      chrome.storage.local.set(
        { listName: e.target["list-name"].value },
        () => {
          displayListName();

          listNameModal.style.display = "none";
          listNameForm.reset();
        }
      );
    }
  };
};

emailButton.onclick = e => {
  const emailForm = document.getElementById("email-form");
  const selectAll = document.getElementById("select-all");
  const selectNone = document.getElementById("select-none");
  const cancelEmail = document.getElementById("closeEmailModal");

  emailModal.style.display = "block";

  selectAll.onclick = e => {
    e.preventDefault();
    let checkboxes = document.querySelectorAll("#email-modal [name*=ring]");
    checkboxes.forEach(cbox => (cbox.checked = true));
  };

  selectNone.onclick = e => {
    e.preventDefault();
    let checkboxes = document.querySelectorAll("#email-modal [name*=ring]");
    checkboxes.forEach(cbox => (cbox.checked = false));
  };

  cancelEmail.onclick = e => {
    emailModal.style.display = "none";
    emailForm.reset();
  };

  emailForm.onsubmit = e => {
    const from = emailForm["from"].value;
    const to = emailForm["to"].value;
    // const message = emailForm["message"].value;

    e.preventDefault();

    // indexes of selected rings
    const checkedArr = [
      ...document.querySelectorAll(
        '#email-form input[type="checkbox"][name*="ring"]:checked'
      )
    ].map(el => el.value);

    if (checkedArr.length > 0) {
      // loading animation
      document.querySelector("#sendButton").classList.add("invisible");
      document
        .querySelector("#email-form div.loader")
        .classList.remove("invisible");

      // process form data
      const sendRings = allData.filter((x, index) =>
        checkedArr.includes(index.toString())
      );

      let fmt = "";

      !!to.length
        ? (fmt +=
            "Dear " +
            to +
            ", %0D%0A%0D%0APlease find my Wish List below.%0D%0A%0D%0A")
        : null;

      // !!message.length ? (fmt += message + ", %0D%0A%0D%0A") : null;

      sendRings.forEach(
        (x, index) =>
          (fmt += `${index + 1}.%0D%0A${x.url}%0D%0A${x.title}%0D%0A${
            !!x.price ? "$" + x.price : ""
          }%0D%0A${x.notes}%0D%0A%0D%0A`)
      );

      !!from.length ? (fmt += "From " + from) : null;

      fmt += `%0D%0A%0D%0A© Engagement Ring Wish List%0D%0AEstate Diamond Jewelry%0D%0Ahttps://www.estatediamondjewelry.com`;

      const mailto = document.createElement("a");
      mailto.href = `mailto:${emailForm["email"].value}?subject=${name.innerText}&body=${fmt}`;

      mailto.click();

      // remove form data
      emailForm.reset();

      // close modal
      emailModal.style.display = "none";

      // close loading animation
      document
        .querySelector("#email-form div.loader")
        .classList.add("invisible");
      document.querySelector("#sendButton").classList.remove("invisible");

      // emailSentSnackbar();
    } else {
      alert("Please select at least one item.");
    }
  };
};

const setupEmailCheckboxes = () => {
  const checkboxDiv = document.getElementById("select-rings-email");
  checkboxDiv.innerHTML = allData
    .map((item, i) => {
      return `<input type="checkbox" name="ring${i}" id="ring-${i}" value="${i}" checked/>
    ${
      item.image
        ? "<img src='" +
          item.image +
          "' alt='" +
          item.title +
          "' class='email-ring-img'/>"
        : "<i style='margin: auto'>image unavailable</i>"
    }
    <label class="unbold" for='ring-${i}'> ${item.title}
    ${
      item.notes
        ? `<span class="email-notes">` +
          capDescriptionLength(item.notes, 50) +
          `</span>`
        : `<span class="email-notes"><i>no notes</i></span>`
    }
    ${
      item.price
        ? "<div class='price-container'><span class='right'>" +
          parseFloat(item.price).toLocaleString("en-US", {
            style: "currency",
            currency: "USD"
          }) +
          "</span></div>"
        : "<div class='price-container'><span class='right'><i>no price</i></span></div>"
    }</label>`;
    })
    .join("");
};

const capDescriptionLength = (description, len) => {
  return !!description
    ? description.length > len
      ? description.slice(0, len - 3) + "..."
      : description
    : description;
};

const emptyList = () => {
  document.querySelector("div.items-container").classList.add("invisible");
  document
    .querySelector("div#nav__search-container")
    .classList.add("invisible");
  document.querySelector("div.sort-bar").classList.add("invisible");

  chrome.storage.local.get("listName", result => {
    result.listName === undefined || result.listName === ""
      ? chooseNewName()
      : displayListName();
  });

  ul.innerHTML = `
  <h3 id="empty-list">Add an item to get started. Shop at Amazon to get started
  <a rel="nofollow"
    target="_blank"
    href="https://www.amazon.com/ref=nav_logo"
    >Click here!</a>
  </h3>
  <br />
  
  `;
};

const chooseNewName = () => {
  ul.innerHTML = `
  <div id='choose-name'>
      <form id='name-form'>
        <label for="list-name">Choose a name for your Wish List:</label><br />
        <div class='center'>
          <input id='list-name' name='list-name' type='text' min='5' /><span>'s Wish List</span>
          <button id='name-button' type='submit'>Create</button>
        </div>
      </form>
    </div>
    `;

  document.getElementById("list-name").focus();

  document.getElementById("name-form").onsubmit = e => {
    if (
      document.getElementById("list-name").value.trim().length < 4 ||
      document.getElementById("list-name").value.trim().length > 30
    ) {
      e.preventDefault();
      alert("Name must be between 4 and 30 characters.");
      document.getElementById("list-name").focus();
      document.getElementById("name-form").reset();
    } else {
      e.preventDefault();

      chrome.storage.local.set({
        listName: document.getElementById("list-name").value
      });

      emptyList();
    }
  };
};

const addLoadingCard = () => {
  const loader = document.createElement("li");
  loader.className = "card loading";
  loader.id = "loading";
  loader.innerHTML = `
  <div class="sk-circle">
    <div class="sk-circle1 sk-child"></div>
    <div class="sk-circle2 sk-child"></div>
    <div class="sk-circle3 sk-child"></div>
    <div class="sk-circle4 sk-child"></div>
    <div class="sk-circle5 sk-child"></div>
    <div class="sk-circle6 sk-child"></div>
    <div class="sk-circle7 sk-child"></div>
    <div class="sk-circle8 sk-child"></div>
    <div class="sk-circle9 sk-child"></div>
    <div class="sk-circle10 sk-child"></div>
    <div class="sk-circle11 sk-child"></div>
    <div class="sk-circle12 sk-child"></div>
  </div>
`;
  ul.appendChild(loader);
};

const removeLoadingCard = () => {
  document.getElementById("loading").remove();
};

const alreadyAddedSnackbar = () => {
  snackbar.innerText = "This item has already been added.";
  snackbar.style.backgroundColor = "#f4a03f";
  snackbar.className = "show-added";
  setTimeout(function() {
    snackbar.classList.remove("show-added");
  }, snackbar.innerText.length * 80);
};

const emailSentSnackbar = () => {
  snackbar.innerText = "Email sent!";
  snackbar.style.backgroundColor = "#48a047";
  snackbar.className = "show-sent";
  setTimeout(function() {
    snackbar.classList.remove("show-sent");
  }, snackbar.innerText.length * 150);
};

const fetchFailedSnackbar = () => {
  snackbar.innerHTML = `That didn't work. Please try again or consider <a
      rel="nofollow"
      target="_blank"
      href="https://www.estatediamondjewelry.com/how-use-engagement-ring-wishlist-extension#feedback"
      style="color: white"
      >leaving feedback</a
    > to let us know what went wrong and how we can improve.`;
  snackbar.style.backgroundColor = "#d3312f";
  snackbar.className = "show-failed";
  setTimeout(function() {
    snackbar.classList.remove("show-failed");
  }, snackbar.innerText.length * 50);
};

const displayListName = () => {
  chrome.storage.local.get("listName", res => {
    if (res.listName !== undefined && res.listName !== "") {
      name.innerText = `${res.listName}'s Wish List`;
      document.getElementById("name").classList.remove("invisible");
    }
  });
};

const analytics = ((i, s, o, g, r, a, m) => {
  i["GoogleAnalyticsObject"] = r;
  (i[r] =
    i[r] ||
    function() {
      (i[r].q = i[r].q || []).push(arguments);
    }),
    (i[r].l = 1 * new Date());
  (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m);
})(
  window,
  document,
  "script",
  "https://www.google-analytics.com/analytics.js",
  "ga"
); // Note: https protocol here

ga("create", "UA-145168497-1", "auto"); // Enter your GA identifier
ga("set", "checkProtocolTask", function() {}); // Removes failing protocol check. @see: http://stackoverflow.com/a/22152353/1958200
ga("require", "displayfeatures");
ga("send", "pageview", "/collection.html");
