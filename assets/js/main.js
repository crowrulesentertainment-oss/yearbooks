const navItems = [
  ["Home","index.html"],["Schools","schools.html"],["Grades","grades.html"],
  ["Video Library","videos.html"],["Archives","archives.html"],["Pricing","pricing.html"],
  ["How It Works","how-it-works.html"]
];
const current = location.pathname.split("/").pop() || "index.html";
const header = document.querySelector("[data-header]");
if(header){
  header.innerHTML = `<div class="container nav">
    <a class="brand" href="index.html"><span class="brand-mark">C</span><span>CROWRULES YEARBOOKS<small>A CrowRules Entertainment Company</small></span></a>
    <button class="menu-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button>
    <nav class="nav-links">${navItems.map(([n,u])=>`<a class="${current===u?'active':''}" href="${u}">${n}</a>`).join("")}<a href="contact.html" class="btn btn-primary">Partner With Us</a></nav>
  </div>`;
  const toggle=header.querySelector(".menu-toggle"), links=header.querySelector(".nav-links");
  toggle.addEventListener("click",()=>{const open=links.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
}
const footer=document.querySelector("[data-footer]");
if(footer) footer.innerHTML=`<div class="container"><div class="footer-grid">
  <div><a class="brand" href="index.html"><span class="brand-mark">C</span><span>CROWRULES YEARBOOKS<small>A CrowRules Entertainment Company</small></span></a><p>Every year has a story worth remembering. We bring school memories to life through cinematic video yearbooks and lasting digital archives.</p></div>
  <div><strong>Explore</strong><div class="footer-links"><a href="schools.html">Schools</a><a href="grades.html">All Grades</a><a href="videos.html">Video Library</a><a href="archives.html">Archives</a></div></div>
  <div><strong>Connect</strong><div class="footer-links"><a href="how-it-works.html">How It Works</a><a href="pricing.html">Pricing</a><a href="school-portal.html">School Portal</a><a href="contact.html">Contact</a></div></div>
</div><div class="copyright">© ${new Date().getFullYear()} CrowRules Yearbooks · A CrowRules Entertainment company. Sample website concept; participating schools and video collections are not implied.</div></div>`;
document.querySelectorAll("[data-demo-form]").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const msg=form.querySelector("[data-form-message]");if(msg)msg.textContent="Demo only: this form is not connected yet. Connect a secure backend before accepting submissions.";form.reset();}));
const modal=document.querySelector("#video-modal");
document.querySelectorAll("[data-video-demo]").forEach(el=>el.addEventListener("click",()=>{if(modal){modal.classList.add("open");modal.setAttribute("aria-hidden","false");}}));
if(modal){modal.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",()=>{modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}));modal.addEventListener("click",e=>{if(e.target===modal){modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}});}
const search=document.querySelector("[data-search]");
if(search){const cards=[...document.querySelectorAll("[data-search-card]")];const filter=()=>{const q=search.value.toLowerCase();let count=0;cards.forEach(c=>{const show=c.textContent.toLowerCase().includes(q);c.style.display=show?"":"none";if(show)count++;});const empty=document.querySelector("[data-empty]");if(empty)empty.hidden=count!==0;};search.addEventListener("input",filter);}
