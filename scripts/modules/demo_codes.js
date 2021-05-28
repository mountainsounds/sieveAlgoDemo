let el1 =`<code class='language-javascript'>
        const countPrimes = (n) => {
          let count = 0;
          let nums = new Array(n).fill(true);

        }
    </code>`

  let el2 =`<code class='language-javascript'>
        const countPrimes = (n) => {
          let count = 0;
          let nums = new Array(n).fill(true);

          for (let i = 2; i * i < n; i++) {

          }
        }
    </code>`

  let el3 =`<code class='language-javascript'>
        const countPrimes = (n) => {
          let count = 0;
          let nums = new Array(n).fill(true);

          for (let i = 2; i * i < n; i++) {
            if (nums[i]) {

            }
          }
        }
    </code>`

  let el4 =`<code class='language-javascript'>
        const countPrimes = (n) => {
          let count = 0;
          let nums = new Array(n).fill(true);

          for (let i = 2; i * i < n; i++) {
            if (nums[i]) {
              for (let j = 2; i * j < n; j++) {
                nums[i * j] = false;
              }
            }
          }
        }
    </code>`

  let el5 =`<code class='language-javascript'>
        const countPrimes = (n) => {
          let count = 0;
          let nums = new Array(n).fill(true);

          for (let i = 2; i * i < n; i++) {
            if (nums[i]) {
              for (let j = 2; i * j < n; j++) {
                nums[i * j] = false;
              }
            }
          }

          for (let i = 2; i < n; i++) {
            if (nums[i]) {
              count++;
            }
          }

          return count;
        }
    </code>`

  let elementArr = [el1, el2, el3, el4, el5];
  let initialState = `<pre id="codeContainer" class="language-javascript" tabindex="0"><code>
  const countPrimes = (n) => {

  }
</code></pre>`;
