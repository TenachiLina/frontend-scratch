export default function ShiftsDropDownList({ Shifts, as = "div" }) {
  const Wrapper = as; // can be 'td' or 'div'

  return (
    <Wrapper>
      <div>
        <select 
          className="dropdown" 
          defaultValue=""
        >
          <option value="" disabled>
            Choose a shift:
          </option>
          {Shifts.map((sh) => (
            <option key={sh.id} value={sh.num}>
              {sh.num}
            </option>
          ))}
        </select>
      </div>
    </Wrapper>
  );
}
