import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "DB Config", end: true },
  { to: "/queries", label: "Queries" },
  { to: "/execute", label: "Execute" },
  { to: "/audit-logs", label: "Audit Logs" },
];

function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="brand">
        Query Tool
      </NavLink>
      <ul className="nav-links">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default Navbar;
