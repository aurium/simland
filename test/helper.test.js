describe('Helper', function(){
  describe('round2()', function(){
    it('should round', function(){
      assert( round2(1.2345) == 1.23 );
      assert( round2(-1.234) == -1.23 );
      assert( round2(1.9999) == 2 );
    })
  })
})
